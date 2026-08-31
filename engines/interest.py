"""Statutory interest under MSMED Act 2006 Section 16.

Pure math engine. Reads the RBI Bank Rate from config/rbi_rate.json and never
accepts a hardcoded rate as a parameter.

Legal basis:
  s.15 - payment due within the agreed date (max 45 days from acceptance), or
         within 15 days if there is no written agreement (day 16 is the
         "appointed day").
  s.16 - compound interest with MONTHLY RESTS at 3x the RBI Bank Rate.
  Partial payments are appropriated to interest first, then principal.
  (DSL Enterprises Pvt Ltd v MSEDCL 2018(3)BomCR4.)
"""

import json
from datetime import date

from dateutil.relativedelta import relativedelta

DEFAULT_CONFIG_PATH = "config/rbi_rate.json"
STATUTORY_MULTIPLE = 3
MONTHS_PER_YEAR = 12
MAX_AGREED_DAYS = 45
NO_AGREEMENT_APPOINTED_OFFSET = 16


def _read_bank_rate(config_path: str) -> float:
    with open(config_path, "r", encoding="utf-8") as fh:
        return float(json.load(fh)["bank_rate"])


def appointed_day(acceptance_date: date, agreed_days: int | None) -> date:
    """Return the first day statutory interest starts accruing.

    No written agreement (agreed_days is None): acceptance_date + 16 days.
    Written agreement: cap agreed_days at 45, then acceptance_date + days + 1.
    """
    if agreed_days is None:
        return acceptance_date + relativedelta(days=NO_AGREEMENT_APPOINTED_OFFSET)
    capped = min(agreed_days, MAX_AGREED_DAYS)
    return acceptance_date + relativedelta(days=capped + 1)


def section16_interest(
    principal: float,
    start: date,
    end: date,
    config_path: str = DEFAULT_CONFIG_PATH,
) -> dict:
    """Compound the statutory interest with monthly rests from start to end.

    start - first day interest accrues (output of appointed_day)
    end   - date payment is actually made (or today if still unpaid)
    """
    bank_rate = _read_bank_rate(config_path)
    statutory_rate_pa = STATUTORY_MULTIPLE * bank_rate
    monthly_rate = statutory_rate_pa / MONTHS_PER_YEAR

    balance = float(principal)
    schedule = []
    cur = start

    while cur < end:
        nxt = cur + relativedelta(months=1)
        if nxt <= end:
            period_interest = balance * monthly_rate
            period_to = nxt
        else:
            frac = (end - cur).days / (nxt - cur).days
            period_interest = balance * monthly_rate * frac
            period_to = end

        schedule.append(
            {
                "from": cur,
                "to": period_to,
                "opening_balance": round(balance, 2),
                "interest_this_period": round(period_interest, 2),
            }
        )
        balance += period_interest
        cur = period_to

    interest = round(balance - float(principal), 2)
    total_due = round(float(principal) + interest, 2)

    return {
        "principal": float(principal),
        "interest": interest,
        "total_due": total_due,
        "statutory_rate_pa": statutory_rate_pa,
        "bank_rate_used": bank_rate,
        "schedule": schedule,
    }


def appropriate_payment(
    payment: float,
    interest_accrued: float,
    principal_outstanding: float,
) -> dict:
    """Apply a partial payment: interest first, then principal."""
    applied_to_interest = min(payment, interest_accrued)
    remainder = payment - applied_to_interest
    applied_to_principal = min(remainder, principal_outstanding)

    return {
        "payment_received": payment,
        "applied_to_interest": applied_to_interest,
        "applied_to_principal": applied_to_principal,
        "interest_remaining": interest_accrued - applied_to_interest,
        "principal_remaining": principal_outstanding - applied_to_principal,
    }
