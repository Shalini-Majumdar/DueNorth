"""Synthetic invoice ledger generator.

Simulates realistic Indian MSME B2B payment behaviour. This is the only data
source for Phase 2. The CSV is written once and never regenerated inside the
app loop.
"""

from __future__ import annotations

import os
from datetime import date, timedelta

import numpy as np
import pandas as pd

SECTORS = {
    "textiles": 0.45,
    "auto_components": 0.30,
    "electronics": 0.35,
    "construction": 0.55,
    "pharma": 0.20,
}

N_CUSTOMERS = 599
DUE_START = date(2025, 1, 1)
DUE_END = date(2026, 6, 30)

LEDGER_COLUMNS = [
    "invoice_id",
    "customer_id",
    "sector",
    "amount",
    "typical_order_size",
    "due_date",
    "actual_paid_date",
    "days_past_due",
    "customer_on_time_rate",
    "customer_ptp_kept_rate",
    "customer_ptp_history",
    "status",
    "partial_paid_amount",
    "is_late",
]

DEFAULT_LEDGER_PATH = "data/synthetic_ledger.csv"

# median amount ~ Rs 73,000  ->  exp(mu) = 73_000
_AMOUNT_LOG_MU = np.log(73_000)
_AMOUNT_LOG_SIGMA = 0.55


def _build_customers(rng: np.random.Generator) -> pd.DataFrame:
    sectors = rng.choice(list(SECTORS), size=N_CUSTOMERS)
    # on-time reliability, Beta(5, 3) rescaled into [0.05, 0.99]
    on_time = 0.05 + 0.94 * rng.beta(5.0, 3.0, size=N_CUSTOMERS)
    # PtP-kept rate: correlated with on-time reliability plus noise, same range
    ptp_kept = np.clip(
        on_time + rng.normal(0.0, 0.08, size=N_CUSTOMERS), 0.05, 0.99
    )
    ptp_history = rng.integers(0, 25, size=N_CUSTOMERS)
    typical_order = np.exp(
        rng.normal(_AMOUNT_LOG_MU, _AMOUNT_LOG_SIGMA, size=N_CUSTOMERS)
    )
    return pd.DataFrame(
        {
            "customer_id": [f"CUST{i:04d}" for i in range(1, N_CUSTOMERS + 1)],
            "sector": sectors,
            "customer_on_time_rate": on_time,
            "customer_ptp_kept_rate": ptp_kept,
            "customer_ptp_history": ptp_history,
            "typical_order_size": typical_order,
        }
    )


def make_ledger(n: int = 5000, seed: int = 42) -> pd.DataFrame:
    """Generate n synthetic invoices and save to data/synthetic_ledger.csv."""
    rng = np.random.default_rng(seed)
    customers = _build_customers(rng)

    cust_idx = rng.integers(0, N_CUSTOMERS, size=n)
    rows = customers.iloc[cust_idx].reset_index(drop=True)

    # amount = customer's typical order size * a per-invoice variation factor
    variation = np.exp(rng.normal(0.0, 0.25, size=n))
    amount = rows["typical_order_size"].to_numpy() * variation

    span_days = (DUE_END - DUE_START).days
    due_offsets = rng.integers(0, span_days + 1, size=n)
    due_dates = [DUE_START + timedelta(days=int(o)) for o in due_offsets]

    size_ratio = np.minimum(amount / rows["typical_order_size"].to_numpy(), 3.0)
    sector_base = rows["sector"].map(SECTORS).to_numpy()
    p_late = (
        sector_base * 0.5
        + (1 - rows["customer_on_time_rate"].to_numpy()) * 0.4
        + size_ratio / 3 * 0.1
    )
    p_late = np.clip(p_late, 0.02, 0.95)
    is_late = (rng.random(n) < p_late).astype(int)

    # status assignment: ~6% partial, ~3% disputed, ~1% unpaid, rest paid
    u = rng.random(n)
    status = np.full(n, "paid", dtype=object)
    status[u < 0.17] = "unpaid"
    status[u < 0.12] = "disputed"
    status[u < 0.06] = "partial"

    days_past_due = np.zeros(n, dtype=int)
    late_dpd = np.clip(rng.exponential(20.0, size=n).astype(int) + 1, 1, 150)
    early_dpd = -rng.integers(0, 11, size=n)
    unresolved_dpd = np.clip(rng.exponential(35.0, size=n).astype(int) + 1, 1, 250)

    resolved = np.isin(status, ["paid", "partial"])
    days_past_due = np.where(resolved & (is_late == 1), late_dpd, days_past_due)
    days_past_due = np.where(resolved & (is_late == 0), early_dpd, days_past_due)
    days_past_due = np.where(~resolved, unresolved_dpd, days_past_due)

    actual_paid_date = [
        (due_dates[i] + timedelta(days=int(days_past_due[i]))) if resolved[i] else None
        for i in range(n)
    ]

    partial_paid_amount = np.where(
        status == "partial", amount * rng.uniform(0.2, 0.8, size=n), 0.0
    )

    ledger = pd.DataFrame(
        {
            "invoice_id": [f"INV{i:06d}" for i in range(n)],
            "customer_id": rows["customer_id"].to_numpy(),
            "sector": rows["sector"].to_numpy(),
            "amount": np.round(amount, 2),
            "typical_order_size": np.round(rows["typical_order_size"].to_numpy(), 2),
            "due_date": due_dates,
            "actual_paid_date": actual_paid_date,
            "days_past_due": days_past_due.astype(int),
            "customer_on_time_rate": rows["customer_on_time_rate"].to_numpy(),
            "customer_ptp_kept_rate": rows["customer_ptp_kept_rate"].to_numpy(),
            "customer_ptp_history": rows["customer_ptp_history"].to_numpy().astype(int),
            "status": status,
            "partial_paid_amount": np.round(partial_paid_amount, 2),
            "is_late": is_late,
        }
    )[LEDGER_COLUMNS]

    os.makedirs(os.path.dirname(DEFAULT_LEDGER_PATH), exist_ok=True)
    ledger.to_csv(DEFAULT_LEDGER_PATH, index=False)
    return ledger


if __name__ == "__main__":
    df = make_ledger()
    print(f"Generated {len(df)} invoices -> {DEFAULT_LEDGER_PATH}")
    print(f"Late rate: {df['is_late'].mean():.1%}")
    print(df["status"].value_counts().to_dict())
