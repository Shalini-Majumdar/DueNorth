"""Manual end-to-end smoke test — one function per DueNorth feature.

Run from anywhere:  python scripts/manual/feature_tests.py
(the script chdirs to the repo root so the relative data/ config/ model paths
resolve).

Each function prints a header, runs the canonical example code for that feature
(drawn from the Phase 1-4 build specs), and prints PASS or FAIL. Nothing here is
collected by pytest — pyproject.toml scopes the suite to tests/.

Note: test_agent_loop() and test_msefc_prefill() write demand_*.pdf /
samadhaan_*.xlsx into out/ (gitignored) as a side effect.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ROOT))
os.chdir(_ROOT)


def test_udyam_gate():
    print("=== Feature 1: Udyam Gate ===")
    try:
        from engines.udyam import onboard

        micro = onboard(
            {"udyam_status": "Micro", "udyam_number": "UDYAM-MH-12-0001234"}
        )
        assert micro["flow"] == "full" and micro["statutory_eligible"] is True

        medium = onboard({"udyam_status": "Medium"})
        assert medium["flow"] == "reminders_only"
        assert medium["statutory_eligible"] is False

        try:
            onboard({"udyam_status": "Small", "udyam_number": "not-a-urn"})
        except ValueError:
            pass
        else:
            raise AssertionError("expected ValueError for a bad Small URN")

        print("  Micro/Small -> full, Medium -> reminders_only, bad URN rejected")
        print("PASS")
    except Exception as e:  # noqa: BLE001
        print(f"FAIL: {e}")


def test_interest_calculator():
    print("=== Feature 2: Interest Calculator ===")
    try:
        from datetime import date

        from engines.interest import (
            appointed_day,
            appropriate_payment,
            section16_interest,
        )

        assert appointed_day(date(2026, 1, 1), None) == date(2026, 1, 17)
        assert appointed_day(date(2026, 1, 1), 60) == date(2026, 2, 16)  # capped 45

        r = section16_interest(1_000_000, date(2026, 1, 1), date(2027, 1, 1))
        print(
            f"  1,000,000 for 1yr: interest={r['interest']:,.2f} "
            f"total_due={r['total_due']:,.2f} rate_pa={r['statutory_rate_pa']}"
        )
        assert 175_000 < r["interest"] < 182_000
        assert r["bank_rate_used"] == 0.055
        assert len(r["schedule"]) == 12

        ap = appropriate_payment(10_000, 8_000, 50_000)
        assert ap["applied_to_interest"] == 8_000
        assert ap["applied_to_principal"] == 2_000
        assert ap["principal_remaining"] == 48_000

        print("PASS")
    except Exception as e:  # noqa: BLE001
        print(f"FAIL: {e}")


def test_rail_router():
    print("=== Feature 3: Rail Router ===")
    try:
        from engines.rail_router import route_payment

        pl = route_payment({"invoice_id": "INV-1", "amount": 50_000})
        assert pl["rail"] == "payment_link" and pl["amount_paise"] == 5_000_000

        sc = route_payment({"invoice_id": "INV-2", "amount": 250_000})
        assert sc["rail"] == "smart_collect"
        assert isinstance(sc["amount_paise"], int)
        print("  dry-run: Rs 50k -> payment_link, Rs 2.5L -> smart_collect")

        key = os.environ.get("RAZORPAY_KEY_ID", "")
        if key.startswith("rzp_test_"):
            from engines.rail_router import live_route_payment

            live = live_route_payment({"invoice_id": "TEST-PL-FT001", "amount": 50_000})
            print(
                f"  live: rail={live.get('rail')} id={live.get('id')} "
                f"url={live.get('url')} error={live.get('error')}"
            )
        else:
            print("  live_route_payment skipped (RAZORPAY_KEY_ID is not rzp_test_*)")

        print("PASS")
    except Exception as e:  # noqa: BLE001
        print(f"FAIL: {e}")


def test_dunning_state_machine():
    print("=== Feature 4: Dunning State Machine ===")
    try:
        from engines.dunning import choose_step, render_message, stop_or_escalate

        base = {"status": "unpaid", "statutory_eligible": True}
        assert choose_step({**base, "days_past_due": 5}, 0.1) == "polite"
        assert choose_step({**base, "days_past_due": 20}, 0.1) == "firm"
        assert choose_step({**base, "days_past_due": 50}, 0.1) == "formal"
        assert choose_step({**base, "days_past_due": -5}, 0.8) == "polite"  # pre-emptive
        assert choose_step({**base, "days_past_due": 10, "status": "disputed"}, 0.1) == "HOLD"

        assert (
            stop_or_escalate({**base, "days_past_due": 60})
            == "ESCALATE_MSEFC_PREFILL"
        )
        assert stop_or_escalate({**base, "days_past_due": 45}) == "CONTINUE"

        msg = render_message(
            "polite",
            {
                "buyer_name": "Acme Corp",
                "invoice_id": "INV-1",
                "amount": 50_000,
                "due_date": "2026-07-01",
                "payment_url": "https://rzp.io/x",
            },
        )
        assert "Acme Corp" in msg and "INV-1" in msg
        print("  polite/firm/formal/HOLD + MSEFC escalation + render all correct")
        print("PASS")
    except Exception as e:  # noqa: BLE001
        print(f"FAIL: {e}")


def test_llm_fallback():
    print("=== Feature 5: LLM Fallback ===")
    try:
        from engines.dunning import llm_personalise

        context = {
            "buyer_name": "Test Corp",
            "invoice_id": "INV000001",
            "amount": 50_000,
            "due_date": "2026-07-01",
            "payment_url": "https://rzp.io/test",
        }
        result = llm_personalise(
            "polite", context, gemini_api_key=None, groq_api_key=None
        )
        assert isinstance(result, str) and len(result) > 20
        assert context["payment_url"] in result
        print(f"  fallback message: {result[:90]}...")
        print("PASS")
    except Exception as e:  # noqa: BLE001
        print(f"FAIL: {e}")


def test_late_payment_classifier():
    print("=== Feature 6: Late-Payment Classifier ===")
    try:
        from models import late_payment

        clf = late_payment.load_model()
        assert hasattr(clf, "predict_proba")

        high_risk = {
            "amount": 250_000, "typical_order_size": 90_000,
            "customer_on_time_rate": 0.1, "customer_ptp_kept_rate": 0.15,
            "customer_ptp_history": 2, "sector": "construction",
        }
        low_risk = {
            "amount": 70_000, "typical_order_size": 75_000,
            "customer_on_time_rate": 0.95, "customer_ptp_kept_rate": 0.95,
            "customer_ptp_history": 20, "sector": "pharma",
        }
        p_high = late_payment.score_invoice(high_risk, model=clf)
        p_low = late_payment.score_invoice(low_risk, model=clf)
        print(f"  P(late): high-risk={p_high:.3f}  low-risk={p_low:.3f}")
        assert p_high > 0.5
        assert p_low < 0.7
        print("PASS")
    except Exception as e:  # noqa: BLE001
        print(f"FAIL: {e}")


def test_lift_evaluation():
    print("=== Feature 7: Lift Evaluation ===")
    try:
        from evaluation.lift import compute_lift

        r = compute_lift()
        print(
            f"  n_invoices={r['n_invoices']}  "
            f"lift Rs 30d={r['lift_day_30']:,.0f} ({r['lift_pct_30']:.1f}%)  "
            f"60d={r['lift_day_60']:,.0f}  90d={r['lift_day_90']:,.0f}"
        )
        assert len(r["ai_curve"]) == 91 and len(r["base_curve"]) == 91
        assert r["ai_curve"][0] == 0.0 and r["base_curve"][0] == 0.0
        assert r["lift_pct_30"] > 0
        assert r["ai_curve"][90] > r["base_curve"][90]
        print("PASS")
    except Exception as e:  # noqa: BLE001
        print(f"FAIL: {e}")


def test_agent_loop():
    print("=== Feature 8: Agent Loop ===")
    try:
        import tempfile

        from api.agent_loop import run_agent_loop

        db_path = os.path.join(tempfile.gettempdir(), "duenorth_feature_tests.db")
        if os.path.exists(db_path):
            os.remove(db_path)

        result = run_agent_loop(db_path=db_path, dry_run=True)
        print(f"  {result}")
        assert result["total_processed"] > 0
        assert result["dry_run"] is True
        assert (
            result["dunning_sent"] + result["held_for_human"]
            + result["escalated_msefc"] + result["skipped_paid"]
            == result["total_processed"]
        )
        print("PASS")
    except Exception as e:  # noqa: BLE001
        print(f"FAIL: {e}")


def test_msefc_prefill():
    print("=== Feature 9: MSEFC Prefill ===")
    try:
        from datetime import date

        from engines.escalation import prefill_demand_notice
        from engines.interest import section16_interest

        invoice = {
            "invoice_id": "FT-MSEFC-001",
            "amount": 500_000.0,
            "due_date": date(2026, 3, 1),
            "buyer_name": "Acme Buyer Pvt Ltd",
            "appointed_day": date(2026, 3, 17),
        }
        supplier = {
            "name": "DueNorth Test Supplier",
            "udyam_number": "UDYAM-MH-12-0001234",
            "flow": "full",
        }
        interest_result = section16_interest(
            500_000.0, date(2026, 3, 17), date(2026, 8, 31)
        )
        res = prefill_demand_notice(invoice, supplier, interest_result, output_dir="out")
        print(
            f"  status={res['status']} pdf={res['pdf_path']} xlsx={res['xlsx_path']}"
        )
        assert res["status"] == "PENDING_HUMAN_APPROVAL"
        assert os.path.isfile(res["pdf_path"])
        assert os.path.isfile(res["xlsx_path"])
        print("PASS")
    except Exception as e:  # noqa: BLE001
        print(f"FAIL: {e}")


if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv()
    test_udyam_gate()
    test_interest_calculator()
    test_rail_router()
    test_dunning_state_machine()
    test_llm_fallback()
    test_late_payment_classifier()
    test_lift_evaluation()
    test_agent_loop()
    test_msefc_prefill()
