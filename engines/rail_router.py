"""Payment-rail router.

Decides which Razorpay collection method to use for an invoice, based on the
NPCI per-transaction UPI ceiling of Rs 1,00,000.

  amount <= Rs 1 lakh  -> Payment Link (can be routed to UPI)
  amount >  Rs 1 lakh  -> Smart Collect virtual account (NEFT/RTGS/IMPS)

route_payment() is DRY-RUN only and never touches the network. Phase 3 adds
live_route_payment(), which calls the real Razorpay test-mode API and never
raises (it returns a "failed" dict instead).
"""

import logging
import os

log = logging.getLogger(__name__)

ONE_LAKH = 100_000  # Rs 1,00,000 - NPCI per-transaction UPI limit


def _to_paise(amount_inr: float) -> int:
    """Rupees -> integer paise, guarding against binary-float drift."""
    return round(amount_inr * 100)


def route_payment(invoice: dict, dry_run: bool = True) -> dict:
    """Return the collection rail and a payload preview for an invoice.

    invoice keys:
      invoice_id: str
      amount: float            (rupees)
      upi_sc_available: bool   (optional, default False)

    Raises ValueError if amount <= 0 or invoice_id is missing/empty.
    """
    invoice_id = invoice.get("invoice_id")
    if not invoice_id:
        raise ValueError("invoice_id is required and must be non-empty.")

    amount = invoice.get("amount")
    if amount is None or amount <= 0:
        raise ValueError("amount must be greater than 0.")

    upi_sc_available = invoice.get("upi_sc_available", False)
    amount_paise = _to_paise(amount)

    if amount <= ONE_LAKH:
        return {
            "rail": "payment_link",
            "invoice_id": invoice_id,
            "amount_inr": amount,
            "amount_paise": amount_paise,
            "dry_run": dry_run,
            "razorpay_action": "client.payment_link.create",
            "payload_preview": {
                "amount": amount_paise,
                "currency": "INR",
                "accept_partial": False,
                "reference_id": invoice_id,
                "description": f"Payment for invoice {invoice_id}",
                "reminder_enable": True,
            },
        }

    result = {
        "rail": "smart_collect",
        "invoice_id": invoice_id,
        "amount_inr": amount,
        "amount_paise": amount_paise,
        "dry_run": dry_run,
        "razorpay_action": "client.virtual_account.create",
        "payload_preview": {
            "receivers": {"types": ["bank_account"]},
            "description": f"Smart Collect for invoice {invoice_id}",
            "notes": {
                "invoice_id": invoice_id,
                "amount_inr": amount,
            },
        },
    }
    if not upi_sc_available:
        result["upi_status"] = "coming_soon"
    return result


def _razorpay_client():
    import razorpay

    return razorpay.Client(
        auth=(os.environ["RAZORPAY_KEY_ID"], os.environ["RAZORPAY_KEY_SECRET"])
    )


def live_route_payment(invoice: dict, upi_sc_available: bool = False) -> dict:
    """Create a real Razorpay test-mode payment instrument for an invoice.

    Same result shape as route_payment(), plus real identifiers:
      payment_link -> "id", "url"
      smart_collect -> "va_id"

    Never raises. On any Razorpay or transport error it logs (invoice_id and
    error code only) and returns {"rail": "failed", "error": ..., "retry": True}.
    """
    import razorpay

    invoice_id = invoice["invoice_id"]
    amount = invoice["amount"]
    amount_paise = _to_paise(amount)

    try:
        client = _razorpay_client()

        if amount <= ONE_LAKH:
            payload = {
                "amount": amount_paise,
                "currency": "INR",
                "description": f"Invoice {invoice_id}",
                "reference_id": invoice_id,
                "notify": {"sms": False, "email": False},
                "reminder_enable": False,
            }
            link = client.payment_link.create(payload)
            return {
                "rail": "payment_link",
                "invoice_id": invoice_id,
                "amount_inr": amount,
                "amount_paise": amount_paise,
                "dry_run": False,
                "razorpay_action": "client.payment_link.create",
                "payload_preview": payload,
                "id": link.get("id"),
                "url": link.get("short_url"),
            }

        payload = {
            "receivers": {"types": ["bank_account"]},
            "description": f"DueNorth VA - {invoice_id}",
            "amount_expected": amount_paise,
            "notes": {"invoice_id": invoice_id},
        }
        va = client.virtual_account.create(payload)
        result = {
            "rail": "smart_collect",
            "invoice_id": invoice_id,
            "amount_inr": amount,
            "amount_paise": amount_paise,
            "dry_run": False,
            "razorpay_action": "client.virtual_account.create",
            "payload_preview": payload,
            "va_id": va.get("id"),
        }
        if not upi_sc_available:
            result["upi_status"] = "coming_soon"
        return result

    except razorpay.errors.BadRequestError as exc:
        log.warning(
            "live_route_payment BadRequest invoice=%s code=%s",
            invoice_id,
            getattr(exc, "code", "unknown"),
        )
        return {"rail": "failed", "error": str(exc), "retry": True}
    except Exception as exc:  # noqa: BLE001 - never raise into the caller
        log.warning(
            "live_route_payment error invoice=%s type=%s",
            invoice_id,
            type(exc).__name__,
        )
        return {"rail": "failed", "error": str(exc), "retry": True}
