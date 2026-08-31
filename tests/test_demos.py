"""Phase 3 failure demos — explicit proof that the three safety behaviours work.

Demo A: duplicate webhook is processed exactly once (idempotency).
Demo B: a disputed invoice is held for a human, no payment instrument created.
Demo C: llm_personalise falls back to the template when no LLM keys are set.
"""

import hashlib
import hmac
import json

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api import agent_loop, db, webhook
from engines.dunning import llm_personalise

SECRET = "test_secret"


# --- Demo A ---------------------------------------------------------------

def test_demo_a_duplicate_webhook_idempotency(tmp_path, monkeypatch):
    db_path = str(tmp_path / "demoA.db")
    monkeypatch.setattr(webhook, "DB_PATH", db_path)
    monkeypatch.setenv("RAZORPAY_WEBHOOK_SECRET", SECRET)
    db.init_db(db_path)
    db.upsert_invoice(
        {
            "invoice_id": "INV000042", "customer_id": "CUST0001",
            "amount": 50_000.0, "days_past_due": 12, "status": "unpaid",
            "statutory_eligible": True,
        },
        db_path,
    )

    body = json.dumps(
        {
            "event": "payment.captured",
            "payload": {"payment": {"entity": {"notes": {"invoice_id": "INV000042"}}}},
        }
    ).encode()
    sig = hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()
    headers = {"x-razorpay-signature": sig, "x-razorpay-event-id": "evt_demo_a"}

    with TestClient(webhook.app) as client:
        r1 = client.post("/webhook", content=body, headers=headers)
        r2 = client.post("/webhook", content=body, headers=headers)

    assert r1.status_code == 200
    assert db.get_invoice("INV000042", db_path)["status"] == "paid"
    assert r2.status_code == 200
    assert r2.json() == {"status": "already_processed"}

    conn = db.get_connection(db_path)
    try:
        n = conn.execute(
            "SELECT COUNT(*) c FROM webhook_events WHERE event_id = 'evt_demo_a'"
        ).fetchone()["c"]
    finally:
        conn.close()
    assert n == 1

    print(f"DEMO A: r1={r1.json()} r2={r2.json()} webhook_events rows={n}")


# --- Demo B ---------------------------------------------------------------

def test_demo_b_hitl_gate_on_disputed_invoice(tmp_path):
    ledger_path = str(tmp_path / "demoB.csv")
    db_path = str(tmp_path / "demoB.db")
    pd.DataFrame(
        [
            {
                "invoice_id": "INV000099", "customer_id": "CUST0009",
                "sector": "construction", "amount": 80_000.0,
                "typical_order_size": 80_000.0, "due_date": "2026-02-01",
                "days_past_due": 25, "customer_on_time_rate": 0.4,
                "customer_ptp_kept_rate": 0.4, "customer_ptp_history": 2,
                "status": "disputed",
            }
        ]
    ).to_csv(ledger_path, index=False)

    result = agent_loop.run_agent_loop(ledger_path, db_path, dry_run=True)

    conn = db.get_connection(db_path)
    try:
        hr = conn.execute(
            "SELECT * FROM human_review WHERE invoice_id = 'INV000099'"
        ).fetchone()
        dl = conn.execute(
            "SELECT * FROM dunning_log WHERE invoice_id = 'INV000099'"
        ).fetchall()
        inv = db.get_invoice("INV000099", db_path)
    finally:
        conn.close()

    assert hr is not None and hr["reason"] == "disputed"
    assert any(row["step"] == "HOLD" for row in dl)
    assert all(
        row["action"] not in ("payment_link_created", "va_created") for row in dl
    )
    assert inv["payment_link_id"] is None and inv["va_id"] is None
    assert result["held_for_human"] == 1 and result["dunning_sent"] == 0

    print(
        f"DEMO B: human_review.reason={hr['reason']} "
        f"dunning steps={[r['step'] for r in dl]} "
        f"payment_link_id={inv['payment_link_id']} summary={result}"
    )


# --- Demo C ---------------------------------------------------------------

def test_demo_c_llm_fallback_to_template():
    context = {
        "buyer_name": "Test Corp",
        "invoice_id": "INV000001",
        "amount": 50_000,
        "due_date": "2026-07-01",
        "payment_url": "https://rzp.io/test",
    }
    try:
        result = llm_personalise(
            "polite", context, gemini_api_key=None, groq_api_key=None
        )
    except Exception as exc:  # noqa: BLE001 - the whole point is it must not raise
        pytest.fail(f"llm_personalise raised: {exc}")

    assert isinstance(result, str) and len(result) > 20
    assert context["payment_url"] in result

    print(f"DEMO C: fallback message = {result!r}")
