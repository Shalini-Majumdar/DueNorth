"""Recovery-lift evaluation.

Compares two invoice-chase strategies on the synthetic ledger:
  - AI order:       ranked by (predicted_late_prob * amount), highest first
  - Baseline order: ranked by days_past_due, oldest first

and simulates cumulative Rs recovered by day 30 / 60 / 90 under each.
This is the headline demo metric.
"""

from __future__ import annotations

import os
import sys

import pandas as pd

# Allow `python evaluation/lift.py` from the repo root (script dir, not repo
# root, is on sys.path when run that way).
if __package__ in (None, ""):
    _ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if _ROOT not in sys.path:
        sys.path.insert(0, _ROOT)

from models import late_payment, ptp_reliability

DEFAULT_LEDGER_PATH = "data/synthetic_ledger.csv"
DEFAULT_LATE_MODEL_PATH = "models/late_payment.joblib"
DEFAULT_PTP_MODEL_PATH = "models/ptp_reliability.joblib"

HORIZON = 90


def overdue_invoices(ledger: pd.DataFrame) -> pd.DataFrame:
    """Rows that are past due and not yet settled (days_past_due > 0, unpaid)."""
    return ledger[(ledger["days_past_due"] > 0) & (ledger["status"] != "paid")]


def simulate_recovery(
    invoices: list[dict],
    order: list[dict],
    ptp_score_fn,
    horizon: int = HORIZON,
) -> list[float]:
    """Cumulative Rs recovered by each day 0..horizon under the given order.

    The earlier an invoice is worked (lower rank r), the sooner it resolves;
    a higher PtP reliability resolves sooner and recovers more of the amount.
    """
    recovered = [0.0] * (horizon + 1)
    for r, invoice in enumerate(order):
        score = ptp_score_fn(invoice)
        resolution_day = int(5 + r * 0.3 + (1 - score) * 30)
        if resolution_day <= horizon:
            gain = invoice["amount"] * score
            for d in range(resolution_day, horizon + 1):
                recovered[d] += gain
    return recovered


def _pct(ai: float, base: float) -> float:
    if base == 0:
        return 0.0
    return (ai - base) / base * 100.0


def compute_lift(
    ledger_path: str = DEFAULT_LEDGER_PATH,
    late_model_path: str = DEFAULT_LATE_MODEL_PATH,
    ptp_model_path: str = DEFAULT_PTP_MODEL_PATH,
) -> dict:
    """Load ledger + models, score overdue invoices, run both strategies."""
    ledger = pd.read_csv(ledger_path)
    overdue = overdue_invoices(ledger)

    clf = late_payment.load_model(late_model_path)
    reg = ptp_reliability.load_model(ptp_model_path)

    invoices: list[dict] = []
    for row in overdue.to_dict("records"):
        row["late_prob"] = late_payment.score_invoice(row, model=clf)
        row["ptp_score"] = ptp_reliability.score_ptp(row, model=reg)
        row["priority_score"] = row["late_prob"] * row["amount"]
        invoices.append(row)

    def ptp_score_fn(inv: dict) -> float:
        return inv["ptp_score"]

    ai_order = sorted(invoices, key=lambda i: i["priority_score"], reverse=True)
    base_order = sorted(invoices, key=lambda i: i["days_past_due"], reverse=True)

    ai_curve = simulate_recovery(invoices, ai_order, ptp_score_fn, HORIZON)
    base_curve = simulate_recovery(invoices, base_order, ptp_score_fn, HORIZON)

    lift_30 = ai_curve[30] - base_curve[30]
    lift_60 = ai_curve[60] - base_curve[60]
    lift_90 = ai_curve[90] - base_curve[90]

    return {
        "ai_curve": ai_curve,
        "base_curve": base_curve,
        "lift_day_30": lift_30,
        "lift_day_60": lift_60,
        "lift_day_90": lift_90,
        "lift_pct_30": _pct(ai_curve[30], base_curve[30]),
        "lift_pct_60": _pct(ai_curve[60], base_curve[60]),
        "lift_pct_90": _pct(ai_curve[90], base_curve[90]),
        "n_invoices": len(invoices),
        "total_at_risk": float(overdue["amount"].sum()),
    }


def print_lift_table(results: dict) -> None:
    """Print a formatted lift table to stdout."""
    print("\nRecovery Lift — AI chase order vs oldest-first baseline")
    print(f"  Overdue invoices : {results['n_invoices']}")
    print(f"  Total at risk    : Rs {results['total_at_risk']:,.0f}")
    print(f"  {'Day':>5} | {'AI (Rs)':>16} | {'Baseline (Rs)':>16} | {'Lift (Rs)':>14} | {'Lift %':>8}")
    print("  " + "-" * 72)
    for day, lift, pct in (
        (30, results["lift_day_30"], results["lift_pct_30"]),
        (60, results["lift_day_60"], results["lift_pct_60"]),
        (90, results["lift_day_90"], results["lift_pct_90"]),
    ):
        print(
            f"  {day:>5} | {results['ai_curve'][day]:>16,.0f} | "
            f"{results['base_curve'][day]:>16,.0f} | {lift:>14,.0f} | {pct:>7.1f}%"
        )


if __name__ == "__main__":
    print_lift_table(compute_lift())
