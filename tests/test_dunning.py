import pytest

from engines.dunning import (
    choose_step,
    choose_step_with_model,
    llm_personalise,
    needs_human,
    render_message,
    stop_or_escalate,
)


def _inv(**kw):
    base = {"days_past_due": 0, "status": "unpaid", "statutory_eligible": True}
    base.update(kw)
    return base


# --- choose_step -------------------------------------------------------------

def test_paid_returns_none():
    assert choose_step(_inv(status="paid", days_past_due=99), 0.99) == "none"


def test_disputed_returns_hold():
    assert choose_step(_inv(status="disputed", days_past_due=20), 0.1) == "HOLD"


def test_manual_payment_reported_returns_hold():
    assert choose_step(_inv(manual_payment_reported=True, days_past_due=20), 0.1) == "HOLD"


def test_preemptive_polite_when_high_prob_and_not_due():
    assert choose_step(_inv(days_past_due=-5, statutory_eligible=True), 0.8) == "polite"


def test_no_action_when_low_prob_and_not_due():
    assert choose_step(_inv(days_past_due=-5, statutory_eligible=True), 0.5) == "none"


def test_prob_threshold_is_inclusive():
    assert choose_step(_inv(days_past_due=0), 0.7) == "polite"


def test_dpd_1_polite():
    assert choose_step(_inv(days_past_due=1), 0.0) == "polite"


def test_dpd_15_polite_boundary():
    assert choose_step(_inv(days_past_due=15), 0.0) == "polite"


def test_dpd_16_firm_boundary():
    assert choose_step(_inv(days_past_due=16), 0.0) == "firm"


def test_dpd_30_firm_boundary():
    assert choose_step(_inv(days_past_due=30), 0.0) == "firm"


def test_dpd_31_formal_when_statutory_eligible():
    assert choose_step(_inv(days_past_due=31, statutory_eligible=True), 0.0) == "formal"


def test_dpd_31_firm_when_not_statutory_eligible():
    assert choose_step(_inv(days_past_due=31, statutory_eligible=False), 0.0) == "firm"


def test_dpd_50_formal_when_statutory_eligible():
    assert choose_step(_inv(days_past_due=50, statutory_eligible=True), 0.0) == "formal"


# --- stop_or_escalate ------------------------------------------------------

def test_paid_stops():
    assert stop_or_escalate(_inv(status="paid")) == "STOP"


def test_disputed_escalates_human():
    assert stop_or_escalate(_inv(status="disputed")) == "ESCALATE_HUMAN"


def test_dpd_46_statutory_prefills_msefc():
    assert stop_or_escalate(_inv(days_past_due=46, statutory_eligible=True)) == "ESCALATE_MSEFC_PREFILL"


def test_dpd_45_statutory_continues_boundary():
    assert stop_or_escalate(_inv(days_past_due=45, statutory_eligible=True)) == "CONTINUE"


def test_dpd_60_not_statutory_continues():
    assert stop_or_escalate(_inv(days_past_due=60, statutory_eligible=False)) == "CONTINUE"


def test_unpaid_midcycle_continues():
    assert stop_or_escalate(_inv(days_past_due=10, status="unpaid")) == "CONTINUE"


# --- render_message ------------------------------------------------------------

def test_render_polite():
    msg = render_message(
        "polite",
        {
            "buyer_name": "Acme Corp",
            "invoice_id": "INV-1",
            "amount": 125000,
            "due_date": "2026-07-01",
            "payment_url": "https://pay.example/INV-1",
        },
    )
    assert "INV-1" in msg
    assert "Rs 125,000" in msg
    assert "https://pay.example/INV-1" in msg


def test_render_formal_formats_currency():
    msg = render_message(
        "formal",
        {
            "supplier_name": "Widgets Pvt Ltd",
            "invoice_id": "INV-9",
            "amount": 500000,
            "days_past_due": 60,
            "interest_accrued": 31820.02,
            "total_due": 531820.02,
            "payment_url": "https://pay.example/INV-9",
        },
    )
    assert "Rs 31,820.02" in msg
    assert "Rs 531,820.02" in msg
    assert "MSEFC" in msg


def test_unknown_template_key_raises_keyerror():
    with pytest.raises(KeyError):
        render_message("nope", {})


def test_missing_context_key_raises_keyerror():
    with pytest.raises(KeyError):
        render_message("polite", {"buyer_name": "Acme"})


# --- wire-up: classifier -> choose_step (Phase 2) --------------------------

def test_choose_step_with_model_preemptive():
    """A not-yet-overdue invoice with a high-risk profile must trigger "polite".

    Uses the real trained classifier.
    """
    from models import late_payment

    clf = late_payment.load_model()
    invoice = {
        "amount": 200_000,
        "typical_order_size": 80_000,
        "customer_on_time_rate": 0.08,
        "customer_ptp_kept_rate": 0.15,
        "customer_ptp_history": 3,
        "sector": "construction",
        "days_past_due": -2,
        "status": "unpaid",
        "statutory_eligible": True,
        "manual_payment_reported": False,
    }
    result = choose_step_with_model(invoice, clf)
    assert result == "polite", f"Expected pre-emptive polite, got {result}"


# --- safety gates + LLM personalisation (Phase 3) -------------------------

def test_needs_human_medium():
    inv = {"status": "unpaid", "amount": 50_000}
    sup = {"udyam_status": "Medium"}
    result, reason = needs_human(inv, sup)
    assert result is True and reason == "Medium"


def test_needs_human_disputed():
    inv = {"status": "disputed", "amount": 50_000}
    sup = {"udyam_status": "Small"}
    result, reason = needs_human(inv, sup)
    assert result is True and reason == "disputed"


def test_needs_human_above_threshold():
    inv = {"status": "unpaid", "amount": 1_200_000}
    sup = {"udyam_status": "Small"}
    result, reason = needs_human(inv, sup, config={"hitl_threshold": 1_000_000})
    assert result is True and reason == "above_threshold"


def test_needs_human_false():
    inv = {"status": "unpaid", "amount": 50_000}
    sup = {"udyam_status": "Small"}
    result, reason = needs_human(inv, sup)
    assert result is False and reason == ""


def _llm_context():
    return {
        "buyer_name": "Test Corp",
        "invoice_id": "INV000001",
        "amount": 50_000,
        "due_date": "2026-07-01",
        "payment_url": "https://rzp.io/test",
    }


def test_llm_personalise_fallback_when_no_keys():
    result = llm_personalise(
        "polite", _llm_context(), gemini_api_key=None, groq_api_key=None
    )
    assert isinstance(result, str) and len(result) > 20


def test_llm_personalise_fallback_when_keys_invalid():
    result = llm_personalise(
        "polite", _llm_context(), gemini_api_key="bad_key", groq_api_key="bad_key"
    )
    assert isinstance(result, str) and len(result) > 20
