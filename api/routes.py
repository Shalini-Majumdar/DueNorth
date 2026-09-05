"""REST API for the React frontend.

Read-mostly endpoints over the same engines / models / SQLite the Streamlit
dashboard uses. No new intelligence — a presentation layer only.

Privacy: invoice ids are masked to the last 4 chars and customer_id / buyer_name
are never returned (CLAUDE.md: no PII).
"""

from __future__ import annotations

import json
import logging
import os
import sys
import tempfile
import threading
from datetime import date, timedelta

import pandas as pd
from fastapi import APIRouter, FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from api import db
from data.ingest import ingest
from engines.escalation import prefill_demand_notice
from engines.interest import appointed_day, section16_interest
from engines.udyam import onboard
from evaluation.lift import compute_lift, overdue_invoices
from models import late_payment
from models.late_payment import _engineer as _engineer_features

LEDGER_PATH = "data/synthetic_ledger.csv"
RATE_CONFIG_PATH = "config/rbi_rate.json"
OUTPUT_DIR = "out"
DB_PATH = db.DEFAULT_DB_PATH

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# --- lightweight caches ----------------------------------------------------
_cache: dict = {}


def _model():
    if "model" not in _cache:
        _cache["model"] = late_payment.load_model()
    return _cache["model"]


def _lift():
    if "lift" not in _cache:
        _cache["lift"] = compute_lift()
    return _cache["lift"]


def _invalidate_lift() -> None:
    _cache.pop("lift", None)


def _mask(invoice_id: str | None) -> str:
    if not invoice_id:
        return "****"
    return f"***{str(invoice_id)[-4:]}"


def _ensure_db() -> None:
    db.init_db(DB_PATH)


# --- request models ------------------------------------------------------------

class InterestRequest(BaseModel):
    principal: float
    due_date: str  # YYYY-MM-DD
    days_overdue: int


class PrefillRequest(BaseModel):
    principal: float
    due_date: str
    days_overdue: int
    invoice_id: str | None = None


class ReviewActionRequest(BaseModel):
    action: str  # approve | escalate | hold


class OnboardRequest(BaseModel):
    name: str
    udyam_status: str  # Micro | Small | Medium | not_registered
    udyam_number: str | None = None


_REVIEW_STATUS = {
    "approve": "APPROVED",
    "escalate": "ESCALATED_TO_MSEFC",
    "hold": "ON_HOLD",
}


# --- endpoints ---------------------------------------------------------------

def _score_overdue(overdue: pd.DataFrame, clf) -> list[float]:
    """Batch P(late) for every overdue invoice in one predict_proba call.

    Uses the model's own feature engineering (models.late_payment._engineer)
    reindexed to the trained feature set, so results match score_invoice().
    """
    features = _engineer_features(overdue).reindex(
        columns=list(clf.feature_names_in_), fill_value=0
    )
    return clf.predict_proba(features)[:, 1].tolist()


@router.get("/invoices/overdue")
def overdue_invoices_endpoint() -> list[dict]:
    ledger = pd.read_csv(LEDGER_PATH)
    overdue = overdue_invoices(ledger).copy().reset_index(drop=True)
    clf = _model()
    probs = _score_overdue(overdue, clf)

    rows = []
    for record, prob in zip(overdue.to_dict("records"), probs):
        amount = float(record["amount"])
        rows.append(
            {
                "invoice_id_masked": _mask(record["invoice_id"]),
                "sector": record.get("sector"),
                "amount": amount,
                "days_past_due": int(record["days_past_due"]),
                "pred_late_prob": round(float(prob), 4),
                "priority_score": round(float(prob) * amount, 2),
            }
        )
    rows.sort(key=lambda r: r["priority_score"], reverse=True)
    return rows


@router.get("/lift")
def lift_endpoint() -> dict:
    return _lift()


@router.post("/interest/calculate")
def interest_calculate(body: InterestRequest) -> dict:
    try:
        due = date.fromisoformat(body.due_date)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="due_date must be YYYY-MM-DD") from exc

    start = appointed_day(due, None)
    end = due + timedelta(days=int(body.days_overdue))
    result = section16_interest(float(body.principal), start, end)
    result["appointed_day"] = start.isoformat()
    result["end_date"] = end.isoformat()
    return result


@router.get("/human-review")
def human_review_list() -> list[dict]:
    _ensure_db()
    conn = db.get_connection(DB_PATH)
    try:
        rows = conn.execute(
            "SELECT id, invoice_id, reason, status, created_at "
            "FROM human_review ORDER BY created_at DESC, id DESC"
        ).fetchall()
    finally:
        conn.close()
    return [
        {
            "id": r["id"],
            "invoice_id_masked": _mask(r["invoice_id"]),
            "reason": r["reason"],
            "status": r["status"],
            "created_at": r["created_at"],
        }
        for r in rows
    ]


@router.post("/human-review/{review_id}/action")
def human_review_action(review_id: int, body: ReviewActionRequest) -> dict:
    if body.action not in _REVIEW_STATUS:
        raise HTTPException(status_code=422, detail="action must be approve|escalate|hold")
    _ensure_db()
    conn = db.get_connection(DB_PATH)
    try:
        with conn:
            cur = conn.execute(
                "UPDATE human_review SET status = ? WHERE id = ?",
                (_REVIEW_STATUS[body.action], review_id),
            )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="review item not found")
        row = conn.execute(
            "SELECT id, invoice_id, reason, status, created_at "
            "FROM human_review WHERE id = ?",
            (review_id,),
        ).fetchone()
    finally:
        conn.close()
    return {
        "id": row["id"],
        "invoice_id_masked": _mask(row["invoice_id"]),
        "reason": row["reason"],
        "status": row["status"],
        "created_at": row["created_at"],
    }


@router.post("/dunning/run")
def dunning_run() -> dict:
    from api.agent_loop import run_agent_loop

    summary = run_agent_loop(dry_run=True)
    _invalidate_lift()
    return summary


@router.get("/audit-log")
def audit_log(invoice_id: str | None = None, action: str | None = None) -> list[dict]:
    _ensure_db()
    query = (
        "SELECT id, invoice_id, step, message_sent, action, razorpay_id, "
        "ptp_reliability, follow_up_days, follow_up_on, ts "
        "FROM dunning_log"
    )
    clauses, params = [], []
    if invoice_id:
        clauses.append("invoice_id LIKE ?")
        params.append(f"%{invoice_id}%")
    if action:
        clauses.append("action = ?")
        params.append(action)
    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    query += " ORDER BY ts DESC, id DESC LIMIT 500"

    conn = db.get_connection(DB_PATH)
    try:
        rows = conn.execute(query, params).fetchall()
    finally:
        conn.close()
    return [
        {
            "id": r["id"],
            "invoice_id_masked": _mask(r["invoice_id"]),
            "step": r["step"],
            "action": r["action"],
            "razorpay_id": r["razorpay_id"],
            "ptp_reliability": r["ptp_reliability"],
            "follow_up_days": r["follow_up_days"],
            "follow_up_on": r["follow_up_on"],
            "ts": r["ts"],
        }
        for r in rows
    ]


@router.post("/onboard")
def onboard_endpoint(body: OnboardRequest) -> dict:
    """Run the Udyam gate (engines.udyam.onboard) and persist the supplier.

    This is the first gate in the pipeline: it decides whether the supplier gets
    the full statutory flow (Micro/Small with a valid URN) or the reminders-only
    flow (Medium / unregistered — no Section 16 interest, no MSEFC).
    """
    _ensure_db()
    try:
        result = onboard(
            {
                "name": body.name.strip(),
                "udyam_status": body.udyam_status,
                "udyam_number": (body.udyam_number or "").strip() or None,
            }
        )
    except ValueError as exc:
        # A rejected URN is a business outcome, not a server fault.
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    supplier_id = db.upsert_supplier(result, db_path=DB_PATH)
    log.info("supplier onboarded: flow=%s", result["flow"])

    return {
        "supplier_id": supplier_id,
        "name": result["name"],
        "udyam_status": result["udyam_status"],
        "flow": result["flow"],
        "statutory_eligible": result["statutory_eligible"],
        "explanation": (
            "Micro/Small with a valid Udyam registration: DueNorth may accrue "
            "Section 16 compound interest at 3x the RBI Bank Rate and prefill an "
            "MSEFC demand notice for your approval."
            if result["statutory_eligible"]
            else "Medium or unregistered: statutory interest and MSEFC "
            "escalation do not apply under the MSMED Act 2006. DueNorth will "
            "send payment reminders only."
        ),
    }


@router.get("/supplier")
def supplier_endpoint() -> dict:
    """Return the onboarded supplier, or the flow the agent loop falls back to."""
    _ensure_db()
    stored = db.get_supplier(db_path=DB_PATH)
    if stored is None:
        from api.agent_loop import TEST_SUPPLIER

        return {**TEST_SUPPLIER, "supplier_id": None, "onboarded": False}
    return {**stored, "onboarded": True}


@router.get("/config")
def config_endpoint() -> dict:
    with open(RATE_CONFIG_PATH, "r", encoding="utf-8") as fh:
        cfg = json.load(fh)
    bank_rate = cfg["bank_rate"]
    return {
        "bank_rate": bank_rate,
        "statutory_rate": round(bank_rate * 3, 6),
        "as_of": cfg.get("as_of"),
        "source": cfg.get("source"),
    }


@router.post("/escalation/prefill")
def escalation_prefill(body: PrefillRequest) -> dict:
    try:
        due = date.fromisoformat(body.due_date)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="due_date must be YYYY-MM-DD") from exc

    if not os.path.isdir(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR, exist_ok=True)

    start = appointed_day(due, None)
    end = due + timedelta(days=int(body.days_overdue))
    interest_result = section16_interest(float(body.principal), start, end)

    invoice_id = body.invoice_id or f"DEMO-{due.isoformat()}"
    invoice = {
        "invoice_id": invoice_id,
        "amount": float(body.principal),
        "due_date": due.isoformat(),
        "buyer_name": "Buyer (demo)",
        "appointed_day": start.isoformat(),
    }
    supplier = {
        "name": "DueNorth Demo Supplier",
        "udyam_number": "UDYAM-MH-12-0001234",
        "flow": "full",
    }
    result = prefill_demand_notice(invoice, supplier, interest_result, output_dir=OUTPUT_DIR)
    return {
        "status": result["status"],
        "invoice_id_masked": _mask(invoice_id),
        "pdf_path": result["pdf_path"],
        "xlsx_path": result["xlsx_path"],
        "disclaimer": (
            "Draft under MSMED Act 2006 ss.15-16. Requires human review before "
            "sending. DueNorth never files with the MSEFC automatically."
        ),
    }


@router.post("/ingest")
async def ingest_endpoint(file: UploadFile) -> dict:
    suffix = os.path.splitext(file.filename or "upload.csv")[1] or ".csv"
    content = await file.read()
    fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(content)
        try:
            valid_df, quarantine_df = ingest(tmp_path)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        reasons = (
            quarantine_df["quarantine_reason"].value_counts().to_dict()
            if not quarantine_df.empty
            else {}
        )
        return {
            "filename": file.filename,
            "valid_rows": len(valid_df),
            "quarantined_rows": len(quarantine_df),
            "quarantine_reasons": reasons,
            "columns_detected": list(valid_df.columns),
        }
    finally:
        os.unlink(tmp_path)


@router.get("/faq")
def faq_endpoint() -> list[dict]:
    return FAQ


def _warm_caches() -> None:
    try:
        _model()
        _lift()
        log.info("routes: model + lift caches warm")
    except Exception:  # noqa: BLE001 - warmup is best-effort
        log.warning("routes: cache warmup failed; endpoints will compute on demand")


def register_routes(app: FastAPI) -> None:
    """Attach the REST API + CORS to the FastAPI app (called from webhook.py)."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)
    # Warm the model + lift caches off the request path (skipped under pytest).
    if "pytest" not in sys.modules:
        threading.Thread(target=_warm_caches, daemon=True).start()


FAQ = [
    {
        "section": "Understanding DueNorth",
        "question": "What is Udyam? What's a Udyam Registration Number?",
        "answer": (
            "Udyam is the Government of India's registration system for Micro, "
            "Small, and Medium Enterprises (MSMEs). Your Udyam Registration "
            "Number (URN) looks like UDYAM-MH-12-0001234 — a prefix, your state "
            "code, district code, and a unique serial number. You can register "
            "for free at udyam.gov.in. DueNorth uses your URN to verify whether "
            "you're eligible for statutory interest under the MSMED Act."
        ),
    },
    {
        "section": "Understanding DueNorth",
        "question": "Micro / Small / Medium — what decides my category?",
        "answer": (
            "Your category is based on investment in plant & machinery plus "
            "annual turnover. Micro: investment up to Rs 1 crore, turnover up to "
            "Rs 5 crore. Small: investment up to Rs 10 crore, turnover up to Rs "
            "50 crore. Medium: investment up to Rs 50 crore, turnover up to Rs "
            "250 crore. DueNorth treats Medium differently because the MSMED "
            "Act's delayed-payment protections (Sections 15-16) cover only Micro "
            "and Small suppliers — not Medium."
        ),
    },
    {
        "section": "Understanding DueNorth",
        "question": 'What is "statutory interest" / Section 16?',
        "answer": (
            "Section 16 of the MSMED Act 2006 says that if a buyer delays "
            "payment to a Micro or Small enterprise beyond the agreed date (max "
            "45 days), they must pay compound interest at 3x the RBI Bank Rate. "
            "This is a real, court-enforceable legal entitlement — not something "
            "DueNorth invented. The buyer cannot negotiate it away. DueNorth "
            "calculates this amount exactly, down to the paisa."
        ),
    },
    {
        "section": "Understanding DueNorth",
        "question": "Why 3x the RBI Bank Rate? Where does 16.50% come from?",
        "answer": (
            "The MSMED Act specifies the interest rate as \"three times the bank "
            "rate notified by the Reserve Bank of India.\" The current RBI Bank "
            "Rate is 5.50% (set at the 62nd MPC meeting, August 2026). So "
            "3 x 5.50% = 16.50% per annum, compounded monthly."
        ),
    },
    {
        "section": "Understanding DueNorth",
        "question": "What is the RBI Bank Rate — is that the repo rate?",
        "answer": (
            "No. The Bank Rate and the repo rate are different. The Bank Rate is "
            "the rate at which RBI lends to commercial banks without collateral. "
            "It's currently aligned with the Marginal Standing Facility (MSF) "
            "rate at 5.50%. The repo rate is 5.25%. DueNorth uses the Bank Rate "
            "because that's what Section 16 mandates."
        ),
    },
    {
        "section": "Understanding DueNorth",
        "question": 'What is the "appointed day"?',
        "answer": (
            "The appointed day is the first day interest starts accruing. If you "
            "have a written payment agreement, it's the day after the agreed "
            "date (max 45 days from acceptance). If there's no written "
            "agreement, it's the 16th day after the buyer accepts the goods or "
            "services."
        ),
    },
    {
        "section": "Understanding DueNorth",
        "question": 'What does "compound interest with monthly rests" mean?',
        "answer": (
            "Each month, the interest earned so far gets added to the balance, "
            "and the next month's interest is calculated on the new, larger "
            "balance. \"Monthly rests\" means the compounding happens once a "
            "month, not daily or annually. Over time, this produces more "
            "interest than simple interest."
        ),
    },
    {
        "section": "Understanding DueNorth",
        "question": "What is MSEFC / Samadhaan?",
        "answer": (
            "The Micro and Small Enterprise Facilitation Council (MSEFC) is a "
            "government body that handles delayed-payment disputes. Samadhaan "
            "(samadhaan.msme.gov.in) is the online portal to file complaints. "
            "DueNorth can pre-fill your Samadhaan filing with the exact interest "
            "and supporting data, but it never files automatically — you review "
            "and submit it yourself. The council aims to resolve cases within "
            "90 days."
        ),
    },
    {
        "section": "Understanding DueNorth",
        "question": 'What\'s the difference between "reminders only" and "full" flow?',
        "answer": (
            "If you're a Udyam-registered Micro or Small enterprise, you get the "
            "full flow: payment reminders, statutory interest calculation, "
            "formal demand notices, and MSEFC escalation support. If you're "
            "Medium or unregistered, you get reminders and payment links only — "
            "because the law doesn't cover you for statutory interest."
        ),
    },
    {
        "section": "The Dashboard",
        "question": "What is the AI actually doing?",
        "answer": (
            "The AI ranks your overdue invoices by predicted likelihood of late "
            "payment multiplied by amount. This means high-risk, high-value "
            "invoices appear at the top of your chase list. The ranking uses an "
            "XGBoost classifier trained on payment history, customer "
            "reliability, invoice size, and sector patterns. The AI does NOT "
            "send messages or move money without your knowledge."
        ),
    },
    {
        "section": "The Dashboard",
        "question": "What does pred_late_prob mean?",
        "answer": (
            "It's the model's predicted probability that this specific invoice "
            "will be paid late, based on the customer's payment history, how "
            "large this invoice is relative to their typical orders, and the "
            "sector's average late-payment rate. A score of 0.70 means \"70% "
            "chance of being paid late.\" Higher scores mean chase sooner."
        ),
    },
    {
        "section": "The Dashboard",
        "question": "Why are invoice IDs masked?",
        "answer": (
            "DueNorth masks invoice IDs and hides customer names in the "
            "dashboard for privacy. This is a deliberate design choice, not "
            "missing data. The full IDs are stored in the database and appear in "
            "exports and demand notices."
        ),
    },
    {
        "section": "The Dashboard",
        "question": "Is this my real data or demo data?",
        "answer": (
            "The default view shows synthetic (demo) data. To load your own "
            "invoices, use the CSV/Excel upload in the sidebar. DueNorth maps "
            "common column names from Tally, Zoho, Busy, and other accounting "
            "software automatically."
        ),
    },
    {
        "section": "Recovery Lift",
        "question": 'What does "+Rs 47,61,042 (165.4%)" mean?',
        "answer": (
            "It means that by day 30, chasing invoices in the AI-ranked order "
            "would recover Rs 47,61,042 more than chasing them in oldest-first "
            "order. The 165% is the percentage improvement over the baseline. "
            "This is measured on the synthetic demo ledger — your real results "
            "will depend on your actual invoice portfolio."
        ),
    },
    {
        "section": "Recovery Lift",
        "question": 'What is "oldest-first baseline"?',
        "answer": (
            "It's what most businesses do today — chase whichever invoice has "
            "been overdue the longest. The AI order instead chases whichever "
            "invoice has the highest combination of late-payment risk and "
            "amount, which recovers money faster."
        ),
    },
    {
        "section": "Interest Calculator",
        "question": "Do I enter the full invoice amount or unpaid balance?",
        "answer": (
            "Enter the full original invoice amount. If partial payments have "
            "been made, they are appropriated to interest first, then principal "
            "— per court precedent (DSL Enterprises v MSEDCL). Use the partial "
            "payment feature when available."
        ),
    },
    {
        "section": "Interest Calculator",
        "question": "Is the calculated amount legally enforceable?",
        "answer": (
            "The calculation follows the exact formula specified in Section 16 "
            "of the MSMED Act — compound interest at 3x RBI Bank Rate with "
            "monthly rests. However, DueNorth's output is an engineering "
            "calculation, not legal advice. Have a chartered accountant review "
            "any demand notice before sending it."
        ),
    },
    {
        "section": "Interest Calculator",
        "question": "Does this apply if I'm not Udyam-registered?",
        "answer": (
            "No. Section 16 interest applies only to Micro and Small enterprises "
            "with a valid Udyam registration at the time of supply. If you're "
            "not registered, the interest calculator will still show you the "
            "math, but you cannot legally claim it."
        ),
    },
]
