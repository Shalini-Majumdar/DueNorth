"""Razorpay webhook receiver.

A single POST /webhook endpoint. Verifies the HMAC signature, deduplicates on
the Razorpay event id, records the event, returns 200, and processes the event
in a background task. All state goes to SQLite via api.db. No PII is logged.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
import sentry_sdk
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request

from api import db
from api.routes import register_routes
from engines.rail_router import live_route_payment

# Load repo-root .env on import so the standalone server (uvicorn api.webhook:app)
# sees RAZORPAY_* / WA_* / SENTRY_DSN. Does not override vars already set.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# No-op when SENTRY_DSN is empty/unset — Sentry is never required.
sentry_sdk.init(
    dsn=os.environ.get("SENTRY_DSN", ""),
    traces_sample_rate=0.1,
    send_default_pii=False,
)

log = logging.getLogger(__name__)

WHATSAPP_API_BASE = "https://graph.facebook.com/v20.0"

# Overridable by tests (monkeypatch api.webhook.DB_PATH) before the TestClient
# context is entered.
DB_PATH = db.DEFAULT_DB_PATH


def _webhook_secret() -> str:
    return os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")


def verify_signature(body: bytes, signature: str | None, secret: str) -> bool:
    if not signature or not secret:
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def _extract_invoice_id(payload: dict) -> str | None:
    entities = payload.get("payload", {})
    for key in ("payment", "order", "virtual_account"):
        notes = entities.get(key, {}).get("entity", {}).get("notes") or {}
        if isinstance(notes, dict) and notes.get("invoice_id"):
            return notes["invoice_id"]
    for key in ("payment_link", "invoice"):
        ref = entities.get(key, {}).get("entity", {}).get("reference_id")
        if ref:
            return ref
    return None


# --- notifications ---------------------------------------------------------

def notify_payment_received(invoice_id: str, amount: float) -> None:
    """Send the supplier a WhatsApp "payment_received" notification.

    Reads WA_TOKEN / WA_PHONE_ID / WA_RECIPIENT from the environment. If any is
    missing, or the API call fails, it logs a warning and returns — never raises.
    Only invoice_id and amount are ever logged (never the token or recipient).
    """
    token = os.environ.get("WA_TOKEN")
    phone_id = os.environ.get("WA_PHONE_ID")
    recipient = os.environ.get("WA_RECIPIENT")
    if not (token and phone_id and recipient):
        log.warning("WhatsApp not configured — skipping notification")
        return

    amount_text = f"Rs {amount:,.0f}"
    try:
        resp = httpx.post(
            f"{WHATSAPP_API_BASE}/{phone_id}/messages",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={
                "messaging_product": "whatsapp",
                "to": recipient,
                "type": "template",
                "template": {
                    "name": "payment_received",
                    "language": {"code": "en"},
                    "components": [
                        {
                            "type": "body",
                            "parameters": [
                                {"type": "text", "text": invoice_id},
                                {"type": "text", "text": amount_text},
                            ],
                        }
                    ],
                },
            },
            timeout=15.0,
        )
        resp.raise_for_status()
        log.info("WhatsApp notification sent for %s (%s)", invoice_id, amount_text)
    except Exception as exc:  # noqa: BLE001 - notification failures must not raise
        log.warning("WhatsApp notification failed: %s", str(exc))


# --- event handlers ---------------------------------------------------------

def handle_payment_captured(payload: dict) -> None:
    invoice_id = _extract_invoice_id(payload)
    if not invoice_id:
        log.info("webhook: payment captured with no invoice_id")
        return
    existing = db.get_invoice(invoice_id, DB_PATH)
    if existing and existing["status"] == "paid":
        db.log_dunning(invoice_id, "none", None, "payment_captured_noop", None, DB_PATH)
        return
    db.mark_invoice_paid(invoice_id, DB_PATH)
    db.log_dunning(invoice_id, "none", None, "payment_captured", None, DB_PATH)
    notify_payment_received(invoice_id, existing["amount"] if existing else 0.0)


def handle_link_expired(payload: dict) -> None:
    invoice_id = _extract_invoice_id(payload)
    if not invoice_id:
        log.info("webhook: payment_link.expired with no invoice_id")
        return
    invoice = db.get_invoice(invoice_id, DB_PATH)
    if invoice is None:
        log.info("payment_link.expired: unknown invoice %s", invoice_id)
        return
    if invoice["status"] == "paid":
        log.info("payment_link.expired: %s already paid, no renewal", invoice_id)
        return

    result = live_route_payment(invoice)
    if result.get("rail") == "failed":
        db.log_dunning(invoice_id, "none", None, "link_renew_failed", None, DB_PATH)
        return

    invoice["rail"] = result.get("rail")
    invoice["payment_link_id"] = result.get("id")
    invoice["payment_link_url"] = result.get("url")
    invoice["va_id"] = result.get("va_id")
    db.upsert_invoice(invoice, DB_PATH)
    db.log_dunning(
        invoice_id, "none", None, "link_renewed",
        result.get("id") or result.get("va_id"), DB_PATH,
    )
    log.info("payment_link.expired: renewed link for %s", invoice_id)


def handle_payment_failed(payload: dict) -> None:
    invoice_id = _extract_invoice_id(payload)
    if not invoice_id:
        log.info("webhook: payment.failed with no invoice_id")
        return
    db.log_dunning(invoice_id, "none", None, "payment_failed", None, DB_PATH)


HANDLERS = {
    "payment.captured": handle_payment_captured,
    "payment_link.paid": handle_payment_captured,
    "payment_link.expired": handle_link_expired,
    "payment.failed": handle_payment_failed,
}


def process_event(event_type: str, payload: dict, event_id: str) -> None:
    """Route an event to its handler. Never crashes the background task."""
    try:
        handler = HANDLERS.get(event_type)
        if handler:
            handler(payload)
        else:
            log.info("webhook: unhandled event type %s", event_type)
    except Exception as exc:  # noqa: BLE001 - background task must not crash
        sentry_sdk.capture_exception(exc)
        log.error("process_event failed for %s: %s", event_type, str(exc))


# --- app -------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db(DB_PATH)
    yield


app = FastAPI(lifespan=lifespan)

# REST API + CORS for the React frontend (does not touch the /webhook route).
register_routes(app)


@app.post("/webhook")
async def razorpay_webhook(request: Request, background_tasks: BackgroundTasks):
    raw = await request.body()

    signature = request.headers.get("x-razorpay-signature")
    if not verify_signature(raw, signature, _webhook_secret()):
        raise HTTPException(status_code=400, detail="Invalid signature")

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON") from exc

    event_type = payload.get("event", "")
    payload_hash = hashlib.sha256(raw).hexdigest()
    event_id = request.headers.get("x-razorpay-event-id") or payload_hash
    invoice_id = _extract_invoice_id(payload)

    if db.is_event_processed(event_id, DB_PATH):
        return {"status": "already_processed"}

    try:
        db.record_event(event_id, event_type, invoice_id, payload_hash, DB_PATH)
    except sqlite3.IntegrityError:
        return {"status": "already_processed"}

    background_tasks.add_task(process_event, event_type, payload, event_id)
    return {"status": "ok"}
