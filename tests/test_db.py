import sqlite3

import pytest

from api import db


@pytest.fixture
def db_path(tmp_path):
    p = str(tmp_path / "test.db")
    db.init_db(p)
    return p


def _sample_invoice(**over):
    inv = {
        "invoice_id": "INV000001",
        "customer_id": "CUST0001",
        "amount": 50_000.0,
        "days_past_due": 10,
        "status": "unpaid",
        "statutory_eligible": True,
        "sector": "textiles",
    }
    inv.update(over)
    return inv


def _tables(db_path):
    conn = db.get_connection(db_path)
    try:
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
        return {r["name"] for r in rows}
    finally:
        conn.close()


def test_init_db_creates_all_tables(db_path):
    assert {"invoices", "dunning_log", "webhook_events", "human_review"}.issubset(
        _tables(db_path)
    )


def test_upsert_inserts_new_row(db_path):
    db.upsert_invoice(_sample_invoice(), db_path)
    assert db.get_invoice("INV000001", db_path) is not None


def test_upsert_twice_updates_not_duplicates(db_path):
    db.upsert_invoice(_sample_invoice(status="unpaid"), db_path)
    db.upsert_invoice(_sample_invoice(status="partial"), db_path)
    conn = db.get_connection(db_path)
    try:
        count = conn.execute("SELECT COUNT(*) c FROM invoices").fetchone()["c"]
    finally:
        conn.close()
    assert count == 1
    assert db.get_invoice("INV000001", db_path)["status"] == "partial"


def test_mark_invoice_paid_existing(db_path):
    db.upsert_invoice(_sample_invoice(), db_path)
    assert db.mark_invoice_paid("INV000001", db_path) is True
    assert db.get_invoice("INV000001", db_path)["status"] == "paid"


def test_mark_invoice_paid_missing(db_path):
    assert db.mark_invoice_paid("NOPE", db_path) is False


def test_get_invoice_unknown_returns_none(db_path):
    assert db.get_invoice("NOPE", db_path) is None


def test_get_invoice_returns_fields(db_path):
    db.upsert_invoice(_sample_invoice(amount=73_500.0), db_path)
    row = db.get_invoice("INV000001", db_path)
    assert row["customer_id"] == "CUST0001"
    assert row["amount"] == 73_500.0
    assert row["statutory_eligible"] == 1


def test_log_dunning_retrievable(db_path):
    db.log_dunning("INV000001", "polite", "hello", "dry_run_message", None, db_path)
    conn = db.get_connection(db_path)
    try:
        rows = conn.execute(
            "SELECT * FROM dunning_log WHERE invoice_id = ?", ("INV000001",)
        ).fetchall()
    finally:
        conn.close()
    assert len(rows) == 1
    assert rows[0]["step"] == "polite"


def test_is_event_processed_false_for_unseen(db_path):
    assert db.is_event_processed("evt_1", db_path) is False


def test_is_event_processed_true_after_record(db_path):
    db.record_event("evt_1", "payment.captured", "INV000001", "hash", db_path)
    assert db.is_event_processed("evt_1", db_path) is True


def test_record_event_duplicate_raises_integrity_error(db_path):
    db.record_event("evt_1", "payment.captured", "INV000001", "hash", db_path)
    with pytest.raises(sqlite3.IntegrityError):
        db.record_event("evt_1", "payment.captured", "INV000001", "hash", db_path)


def test_add_human_review_pending_status(db_path):
    db.add_human_review("INV000001", "disputed", db_path=db_path)
    conn = db.get_connection(db_path)
    try:
        row = conn.execute(
            "SELECT * FROM human_review WHERE invoice_id = ?", ("INV000001",)
        ).fetchone()
    finally:
        conn.close()
    assert row["reason"] == "disputed"
    assert row["status"] == "PENDING_HUMAN_APPROVAL"
