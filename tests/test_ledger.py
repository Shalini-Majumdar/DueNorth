import os

import pandas as pd

from data.generate_ledger import LEDGER_COLUMNS, SECTORS, make_ledger


def test_columns_exact():
    df = make_ledger(n=1000, seed=1)
    assert list(df.columns) == LEDGER_COLUMNS


def test_late_rate_in_band():
    df = make_ledger(n=5000, seed=42)
    assert 0.25 <= df["is_late"].mean() <= 0.55


def test_no_paid_date_on_disputed_or_unpaid():
    df = make_ledger(n=5000, seed=42)
    unresolved = df[df["status"].isin(["disputed", "unpaid"])]
    assert unresolved["actual_paid_date"].isna().all()


def test_partial_paid_amount_below_amount():
    df = make_ledger(n=5000, seed=42)
    partial = df[df["status"] == "partial"]
    assert (partial["partial_paid_amount"] < partial["amount"]).all()
    assert (partial["partial_paid_amount"] > 0).all()


def test_partial_paid_amount_zero_for_non_partial():
    df = make_ledger(n=5000, seed=42)
    non_partial = df[df["status"] != "partial"]
    assert (non_partial["partial_paid_amount"] == 0.0).all()


def test_on_time_rate_bounds():
    df = make_ledger(n=5000, seed=42)
    assert df["customer_on_time_rate"].between(0.05, 0.99).all()


def test_sectors_valid():
    df = make_ledger(n=5000, seed=42)
    assert set(df["sector"]).issubset(set(SECTORS))


def test_invoice_ids_unique():
    df = make_ledger(n=5000, seed=42)
    assert df["invoice_id"].is_unique


def test_reproducible():
    a = make_ledger(n=2000, seed=42)
    b = make_ledger(n=2000, seed=42)
    pd.testing.assert_frame_equal(a, b)


def test_csv_written():
    make_ledger(n=500, seed=7)
    assert os.path.isfile("data/synthetic_ledger.csv")
