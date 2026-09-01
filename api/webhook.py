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

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request

from api import db
from engines.rail_router import live_route_payment

# Load repo-root .env on import so the standalone server (uvicorn api.webhook:app)
# sees RAZORPAY_* secrets. Does not override vars already set (tests still win).
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

log = logging.getLogger(__name__)

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
        log.error(
            "webhook: process_event failed event=%s type=%s",
            event_id,
            type(exc).__name__,
        )


# --- app -------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db(DB_PATH)
    yield


app = FastAPI(lifespan=lifespan)


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
