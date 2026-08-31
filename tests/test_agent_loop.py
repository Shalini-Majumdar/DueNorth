from unittest.mock import Mock

import pandas as pd
import pytest

from api import agent_loop, db

LEDGER_COLUMNS = [
    "invoice_id", "customer_id", "sector", "amount", "typical_order_size",
    "due_date", "days_past_due", "customer_on_time_rate",
    "customer_ptp_kept_rate", "customer_ptp_history", "status",
]


def _row(invoice_id, amount, days_past_due, status):
    return {
        "invoice_id": invoice_id,
        "customer_id": "CUST0001",
        "sector": "textiles",
        "amount": amount,
        "typical_order_size": 50_000.0,
        "due_date": "2026-03-01",
        "days_past_due": days_past_due,
        "customer_on_time_rate": 0.6,
        "customer_ptp_kept_rate": 0.6,
        "customer_ptp_history": 5,
        "status": status,
    }


@pytest.fixture
def env(tmp_path):
    rows = [
        _row("INV000001", 50_000.0, 20, "unpaid"),      # firm  -> dunning_sent
        _row("INV000002", 30_000.0, 5, "unpaid"),       # polite -> dunning_sent
        _row("INV000003", 50_000.0, 10, "disputed"),    # held_for_human
        _row("INV000004", 1_500_000.0, 10, "unpaid"),   # above_threshold -> held
        _row("INV000005", 50_000.0, 60, "unpaid"),      # msefc prefill
        _row("INV000006", 50_000.0, -3, "unpaid"),      # not overdue, filtered out
        _row("INV000007", 50_000.0, 15, "paid"),        # paid, filtered out
    ]
    ledger_path = str(tmp_path / "ledger.csv")
    pd.DataFrame(rows)[LEDGER_COLUMNS].to_csv(ledger_path, index=False)
    db_path = str(tmp_path / "agent.db")
    db.init_db(db_path)
    return ledger_path, db_path


def _count(db_path, table, where="", args=()):
    conn = db.get_connection(db_path)
    try:
        sql = f"SELECT COUNT(*) c FROM {table}"
        if where:
            sql += f" WHERE {where}"
        return conn.execute(sql, args).fetchone()["c"]
    finally:
        conn.close()


def test_returns_all_keys(env):
    ledger_path, db_path = env
    result = agent_loop.run_agent_loop(ledger_path, db_path, dry_run=True)
    assert set(result) == {
        "total_processed", "dunning_sent", "held_for_human",
        "escalated_msefc", "skipped_paid", "dry_run",
    }


def test_total_processed_positive(env):
    ledger_path, db_path = env
    result = agent_loop.run_agent_loop(ledger_path, db_path, dry_run=True)
    assert result["total_processed"] == 5  # two rows filtered out


def test_bucket_counts_sum_to_total(env):
    ledger_path, db_path = env
    r = agent_loop.run_agent_loop(ledger_path, db_path, dry_run=True)
    assert (
        r["dunning_sent"] + r["held_for_human"]
        + r["escalated_msefc"] + r["skipped_paid"]
        == r["total_processed"]
    )


def test_disputed_invoice_in_human_review(env):
    ledger_path, db_path = env
    agent_loop.run_agent_loop(ledger_path, db_path, dry_run=True)
    assert _count(
        db_path, "human_review",
        "invoice_id = ? AND reason = ?", ("INV000003", "disputed"),
    ) == 1


def test_large_amount_in_human_review(env):
    ledger_path, db_path = env
    agent_loop.run_agent_loop(ledger_path, db_path, dry_run=True)
    assert _count(
        db_path, "human_review",
        "invoice_id = ? AND reason = ?", ("INV000004", "above_threshold"),
    ) == 1


def test_msefc_prefill_creates_files(env):
    ledger_path, db_path = env
    agent_loop.run_agent_loop(ledger_path, db_path, dry_run=True)
    conn = db.get_connection(db_path)
    try:
        row = conn.execute(
            "SELECT * FROM human_review WHERE invoice_id = ? AND reason = 'msefc'",
            ("INV000005",),
        ).fetchone()
    finally:
        conn.close()
    assert row is not None
    import os

    assert os.path.isfile(row["pdf_path"])
    assert os.path.isfile(row["xlsx_path"])


def test_dry_run_does_not_call_live_route(env, monkeypatch):
    ledger_path, db_path = env
    mock = Mock()
    monkeypatch.setattr(agent_loop, "live_route_payment", mock)
    agent_loop.run_agent_loop(ledger_path, db_path, dry_run=True)
    mock.assert_not_called()


def test_one_dunning_log_row_per_processed_invoice(env):
    ledger_path, db_path = env
    result = agent_loop.run_agent_loop(ledger_path, db_path, dry_run=True)
    assert _count(db_path, "dunning_log") == result["total_processed"]


def test_second_run_is_idempotent(env):
    ledger_path, db_path = env
    r1 = agent_loop.run_agent_loop(ledger_path, db_path, dry_run=True)
    dunning_after_1 = _count(db_path, "dunning_log")
    hr_after_1 = _count(db_path, "human_review")
    invoices_after_1 = _count(db_path, "invoices")

    r2 = agent_loop.run_agent_loop(ledger_path, db_path, dry_run=True)
    assert r2 == r1
    assert _count(db_path, "dunning_log") == dunning_after_1
    assert _count(db_path, "human_review") == hr_after_1
    assert _count(db_path, "invoices") == invoices_after_1
