"""Agent orchestration loop.

Runs on demand (from the dashboard or a CLI). Iterates the overdue invoices in
the ledger, applies the safety gates, and either sends a dunning action or
routes the invoice to human review. In dry_run mode (the default) it never
calls the live Razorpay API.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import UTC, date, datetime
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

from api import db
from engines.dunning import (
    choose_step_with_model,
    llm_personalise,
    needs_human,
    stop_or_escalate,
)
from engines.escalation import prefill_demand_notice
from engines.interest import appointed_day as compute_appointed_day
from engines.interest import section16_interest
from engines.rail_router import live_route_payment
from evaluation.lift import overdue_invoices
from models import late_payment

# Load repo-root .env so a standalone run sees Razorpay / LLM keys. Does not
# override vars already set in the environment.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

log = logging.getLogger(__name__)

DEFAULT_LEDGER_PATH = "data/synthetic_ledger.csv"
DEFAULT_CONFIG_PATH = "config/config.json"
OUTPUT_DIR = "out"

TEST_SUPPLIER = {
    "name": "DueNorth Test Supplier",
    "udyam_status": "Small",
    "udyam_number": "UDYAM-MH-12-0001234",
    "flow": "full",
    "statutory_eligible": True,
}


def _load_config(path: str = DEFAULT_CONFIG_PATH) -> dict:
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError):
        return {"hitl_threshold": 1_000_000}


def _has_dunning_log(db_path: str, invoice_id: str) -> bool:
    conn = db.get_connection(db_path)
    try:
        row = conn.execute(
            "SELECT 1 FROM dunning_log WHERE invoice_id = ? LIMIT 1", (invoice_id,)
        ).fetchone()
        return row is not None
    finally:
        conn.close()


def _has_human_review(db_path: str, invoice_id: str, reason: str) -> bool:
    conn = db.get_connection(db_path)
    try:
        row = conn.execute(
            "SELECT 1 FROM human_review WHERE invoice_id = ? AND reason = ? LIMIT 1",
            (invoice_id, reason),
        ).fetchone()
        return row is not None
    finally:
        conn.close()


def _due_date(raw) -> date:
    try:
        return date.fromisoformat(str(raw)[:10])
    except ValueError:
        return datetime.now(UTC).date()


def _to_db_invoice(row: dict) -> dict:
    return {
        "invoice_id": row["invoice_id"],
        "customer_id": row["customer_id"],
        "amount": float(row["amount"]),
        "days_past_due": int(row["days_past_due"]),
        "status": row["status"],
        "statutory_eligible": TEST_SUPPLIER["statutory_eligible"],
        "sector": row.get("sector"),
        "due_date": str(row.get("due_date", ""))[:10],
    }


def run_agent_loop(
    ledger_path: str = DEFAULT_LEDGER_PATH,
    db_path: str = db.DEFAULT_DB_PATH,
    dry_run: bool = True,
) -> dict:
    """Process every overdue invoice through the safety gates and dunning steps.

    The returned counts are a deterministic classification of the invoices, so
    the summary is identical across repeated runs. All database side effects are
    guarded to stay idempotent.
    """
    db.init_db(db_path)
    config = _load_config()
    clf = late_payment.load_model()
    supplier = dict(TEST_SUPPLIER)

    gemini_key = os.environ.get("GEMINI_API_KEY")
    groq_key = os.environ.get("GROQ_API_KEY")
    today = datetime.now(UTC).date()

    ledger = pd.read_csv(ledger_path)
    overdue = overdue_invoices(ledger)

    counts = {
        "total_processed": 0,
        "dunning_sent": 0,
        "held_for_human": 0,
        "escalated_msefc": 0,
        "skipped_paid": 0,
        "dry_run": dry_run,
    }

    for raw in overdue.to_dict("records"):
        counts["total_processed"] += 1
        invoice_id = raw["invoice_id"]

        invoice = _to_db_invoice(raw)
        db.upsert_invoice(invoice, db_path)
        already_done = _has_dunning_log(db_path, invoice_id)

        # feature keys for the model + full context for messaging
        invoice["typical_order_size"] = float(raw["typical_order_size"])
        invoice["customer_on_time_rate"] = float(raw["customer_on_time_rate"])
        invoice["customer_ptp_kept_rate"] = float(raw["customer_ptp_kept_rate"])
        invoice["customer_ptp_history"] = int(raw["customer_ptp_history"])
        invoice["buyer_name"] = raw.get("customer_id", "Buyer")
        due = _due_date(raw.get("due_date"))
        invoice["appointed_day"] = compute_appointed_day(due, None)

        # Step 3 — needs_human
        flagged, reason = needs_human(invoice, supplier, config)
        if flagged:
            if not already_done:
                if not _has_human_review(db_path, invoice_id, reason):
                    db.add_human_review(invoice_id, reason, db_path=db_path)
                db.log_dunning(invoice_id, "HOLD", None, "held", None, db_path)
            counts["held_for_human"] += 1
            continue

        # Step 4 — stop_or_escalate
        decision = stop_or_escalate(invoice)
        if decision == "STOP":
            if not already_done:
                db.log_dunning(invoice_id, "none", None, "skipped_paid", None, db_path)
            counts["skipped_paid"] += 1
            continue
        if decision == "ESCALATE_HUMAN":
            if not already_done:
                if not _has_human_review(db_path, invoice_id, "disputed"):
                    db.add_human_review(invoice_id, "disputed", db_path=db_path)
                db.log_dunning(invoice_id, "HOLD", None, "escalated_human", None, db_path)
            counts["held_for_human"] += 1
            continue
        if decision == "ESCALATE_MSEFC_PREFILL":
            if not already_done:
                interest_result = section16_interest(
                    invoice["amount"], invoice["appointed_day"], today
                )
                prefilled = prefill_demand_notice(
                    invoice, supplier, interest_result, output_dir=OUTPUT_DIR
                )
                if not _has_human_review(db_path, invoice_id, "msefc"):
                    db.add_human_review(
                        invoice_id, "msefc",
                        prefilled["pdf_path"], prefilled["xlsx_path"],
                        db_path=db_path,
                    )
                db.log_dunning(
                    invoice_id, "formal", None, "escalated_msefc", None, db_path
                )
            counts["escalated_msefc"] += 1
            continue

        # Step 5 — dunning step from the model
        step = choose_step_with_model(invoice, clf)

        # Step 6 — nothing to send
        if step in ("none", "HOLD"):
            if not already_done:
                db.log_dunning(invoice_id, step, None, "skipped", None, db_path)
            if step == "HOLD":
                counts["held_for_human"] += 1
            else:
                counts["skipped_paid"] += 1
            continue

        # Step 7 — personalise the message
        payment_url = f"https://rzp.io/dry-run/{invoice_id}"
        context = {
            "buyer_name": invoice["buyer_name"],
            "supplier_name": supplier["name"],
            "invoice_id": invoice_id,
            "amount": invoice["amount"],
            "due_date": invoice["due_date"],
            "days_past_due": invoice["days_past_due"],
            "payment_url": payment_url,
            "interest_accrued": 0.0,
            "total_due": invoice["amount"],
        }
        if step == "formal":
            interest_result = section16_interest(
                invoice["amount"], invoice["appointed_day"], today
            )
            context["interest_accrued"] = interest_result["interest"]
            context["total_due"] = interest_result["total_due"]

        message = llm_personalise(step, context, gemini_key, groq_key)

        # Step 8 — send (or, in dry-run, just log)
        if dry_run:
            if not already_done:
                db.log_dunning(invoice_id, step, message, "dry_run_message", None, db_path)
        else:
            result = live_route_payment(invoice)
            rail = result.get("rail")
            action = "payment_link_created" if rail == "payment_link" else "va_created"
            razorpay_id = result.get("id") or result.get("va_id")
            if rail == "failed":
                action = "payment_instrument_failed"
            db.log_dunning(invoice_id, step, message, action, razorpay_id, db_path)
            db.upsert_invoice(
                {
                    "invoice_id": invoice_id,
                    "rail": rail,
                    "payment_link_id": result.get("id"),
                    "payment_link_url": result.get("url"),
                    "va_id": result.get("va_id"),
                },
                db_path,
            )
        counts["dunning_sent"] += 1

    log.info(
        "agent_loop done: processed=%d sent=%d held=%d msefc=%d",
        counts["total_processed"],
        counts["dunning_sent"],
        counts["held_for_human"],
        counts["escalated_msefc"],
    )
    return counts


if __name__ == "__main__":
    print(run_agent_loop(dry_run=True))
