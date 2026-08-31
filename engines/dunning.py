"""Dunning state machine.

Purely rule-based. Receives the ML classifier's probability as a plain float
parameter; it never imports or calls the model.
"""

import logging

log = logging.getLogger(__name__)

PREEMPTIVE_PROB_THRESHOLD = 0.7
DEFAULT_HITL_THRESHOLD = 1_000_000  # Rs 10 lakh; overridable via config dict

_LLM_PROMPT = (
    "Rewrite this payment reminder in a professional tone. Keep the same facts, "
    "payment URL, and amounts exactly. Original: {rendered}"
)

TEMPLATES = {
    "polite": (
        "Dear {buyer_name}, this is a friendly reminder that invoice {invoice_id} "
        "for Rs {amount:,.0f} was due on {due_date}. "
        "Please settle at your earliest convenience: {payment_url}"
    ),
    "firm": (
        "Dear {buyer_name}, invoice {invoice_id} for Rs {amount:,.0f} is now "
        "{days_past_due} days overdue. Immediate payment is required: {payment_url}"
    ),
    "formal": (
        "STATUTORY NOTICE — {supplier_name}\n"
        "Invoice {invoice_id} for Rs {amount:,.0f} is {days_past_due} days overdue. "
        "Under MSMED Act 2006 Section 16, statutory interest of Rs {interest_accrued:,.2f} "
        "has accrued. Total amount now due: Rs {total_due:,.2f}. "
        "Settle within 15 days to avoid MSEFC proceedings: {payment_url}"
    ),
}


def choose_step(invoice: dict, predicted_late_prob: float) -> str:
    """Decide the dunning action for an invoice.

    invoice keys: days_past_due (int, negative = not yet due), status
    ("paid"|"unpaid"|"partial"|"disputed"), manual_payment_reported (bool,
    optional), statutory_eligible (bool).

    Returns one of: "none", "polite", "firm", "formal", "HOLD".
    """
    status = invoice.get("status")
    dpd = invoice["days_past_due"]
    statutory_eligible = invoice.get("statutory_eligible", False)

    if status == "paid":
        return "none"
    if status == "disputed":
        return "HOLD"
    if invoice.get("manual_payment_reported", False):
        return "HOLD"

    if dpd <= 0:
        if predicted_late_prob >= PREEMPTIVE_PROB_THRESHOLD:
            return "polite"
        return "none"

    if 1 <= dpd <= 15:
        return "polite"
    if 16 <= dpd <= 30:
        return "firm"

    # dpd > 30
    if statutory_eligible:
        return "formal"
    return "firm"


def stop_or_escalate(invoice: dict) -> str:
    """Decide whether the dunning loop continues after choose_step.

    Returns one of: "STOP", "ESCALATE_HUMAN", "ESCALATE_MSEFC_PREFILL",
    "CONTINUE".
    """
    status = invoice.get("status")
    dpd = invoice["days_past_due"]
    statutory_eligible = invoice.get("statutory_eligible", False)

    if status == "paid":
        return "STOP"
    if status == "disputed":
        return "ESCALATE_HUMAN"
    if dpd > 45 and statutory_eligible:
        return "ESCALATE_MSEFC_PREFILL"
    return "CONTINUE"


def render_message(template_key: str, context: dict) -> str:
    """Render a TEMPLATES entry with context.

    Raises KeyError if template_key is unknown or a required placeholder is
    missing from context.
    """
    template = TEMPLATES[template_key]
    return template.format(**context)


def choose_step_with_model(invoice: dict, clf, ptp_model=None) -> str:
    """Wire the late-payment classifier into choose_step().

    Convenience wrapper for the dashboard and the agent loop. Builds the feature
    vector from the invoice dict, reads P(late) from clf, then delegates to the
    deterministic choose_step(). The ML import is function-local so importing
    engines.dunning stays ML-free.

    invoice must have: amount, typical_order_size, customer_on_time_rate,
    customer_ptp_kept_rate, customer_ptp_history, sector, days_past_due, status,
    statutory_eligible.
    """
    from models.late_payment import score_invoice

    predicted_late_prob = score_invoice(invoice, model=clf)
    return choose_step(invoice, predicted_late_prob)


def needs_human(
    invoice: dict, supplier: dict, config: dict | None = None
) -> tuple[bool, str]:
    """Whether this invoice must go to human review before any automated action.

    Returns (True, reason) or (False, "").

    Priority order:
      1. supplier["udyam_status"] == "Medium"  -> "Medium"
      2. invoice["status"] == "disputed"       -> "disputed"
      3. invoice["amount"] > hitl_threshold    -> "above_threshold"
      4. otherwise                             -> (False, "")
    """
    threshold = DEFAULT_HITL_THRESHOLD
    if config and "hitl_threshold" in config:
        threshold = config["hitl_threshold"]

    if supplier.get("udyam_status") == "Medium":
        return True, "Medium"
    if invoice.get("status") == "disputed":
        return True, "disputed"
    if invoice.get("amount", 0) > threshold:
        return True, "above_threshold"
    return False, ""


def _gemini_personalise(prompt: str, api_key: str) -> str | None:
    import google.generativeai as genai

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content(prompt)
    text = (getattr(response, "text", "") or "").strip()
    return text or None


def _groq_personalise(prompt: str, api_key: str) -> str | None:
    import httpx

    resp = httpx.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": "llama3-8b-8192",
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=15.0,
    )
    resp.raise_for_status()
    text = (resp.json()["choices"][0]["message"]["content"] or "").strip()
    return text or None


def llm_personalise(
    template_key: str,
    context: dict,
    gemini_api_key: str | None = None,
    groq_api_key: str | None = None,
) -> str:
    """Personalise a dunning message with an LLM, falling back to the template.

    Tries Gemini, then Groq, then render_message(). Never raises — every
    external call is guarded and a string is always returned.
    """
    try:
        rendered = render_message(template_key, context)
    except Exception:  # noqa: BLE001 - must never raise
        rendered = (
            f"Reminder: invoice {context.get('invoice_id', '')} is due. "
            f"Please pay at {context.get('payment_url', '')}"
        )

    prompt = _LLM_PROMPT.format(rendered=rendered)

    if gemini_api_key:
        try:
            text = _gemini_personalise(prompt, gemini_api_key)
            if text:
                log.info("llm_personalise: used gemini")
                return text
        except Exception:  # noqa: BLE001 - fall through to groq
            log.debug("llm_personalise: gemini path unavailable, falling back")

    if groq_api_key:
        try:
            text = _groq_personalise(prompt, groq_api_key)
            if text:
                log.info("llm_personalise: used groq")
                return text
        except Exception:  # noqa: BLE001 - fall through to template
            log.debug("llm_personalise: groq path unavailable, falling back")

    log.info("llm_personalise: used template")
    return rendered
