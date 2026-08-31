"""SQLite persistence layer for the webhook loop and the agent loop.

Single database file at db/duenorth.db. All functions are synchronous (plain
sqlite3); FastAPI calls them from a background thread. Every function opens and
closes its own short-lived connection.
"""

from __future__ import annotations

import os
import sqlite3

DEFAULT_DB_PATH = "db/duenorth.db"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS invoices (
    invoice_id      TEXT PRIMARY KEY,
    customer_id     TEXT NOT NULL,
    amount          REAL NOT NULL,
    days_past_due   INTEGER NOT NULL,
    status          TEXT NOT NULL,
    statutory_eligible INTEGER NOT NULL,
    sector          TEXT,
    due_date        TEXT,
    buyer_name      TEXT,
    appointed_day   TEXT,
    pred_late_prob  REAL,
    priority_score  REAL,
    rail            TEXT,
    payment_link_id TEXT,
    payment_link_url TEXT,
    va_id           TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dunning_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id      TEXT NOT NULL,
    step            TEXT NOT NULL,
    message_sent    TEXT,
    action          TEXT,
    razorpay_id     TEXT,
    ts              TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS webhook_events (
    event_id        TEXT PRIMARY KEY,
    event_type      TEXT NOT NULL,
    invoice_id      TEXT,
    payload_hash    TEXT,
    processed_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS human_review (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id      TEXT NOT NULL,
    reason          TEXT NOT NULL,
    pdf_path        TEXT,
    xlsx_path       TEXT,
    status          TEXT DEFAULT 'PENDING_HUMAN_APPROVAL',
    created_at      TEXT DEFAULT (datetime('now'))
);
"""

# Columns of `invoices` that upsert_invoice() is allowed to write.
_INVOICE_COLUMNS = (
    "customer_id",
    "amount",
    "days_past_due",
    "status",
    "statutory_eligible",
    "sector",
    "due_date",
    "buyer_name",
    "appointed_day",
    "pred_late_prob",
    "priority_score",
    "rail",
    "payment_link_id",
    "payment_link_url",
    "va_id",
)


def get_connection(db_path: str = DEFAULT_DB_PATH) -> sqlite3.Connection:
    """Return a sqlite3 connection with row_factory = sqlite3.Row."""
    parent = os.path.dirname(db_path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: str = DEFAULT_DB_PATH) -> None:
    """Create all tables if they do not exist. Safe to call on every startup."""
    conn = get_connection(db_path)
    try:
        with conn:
            conn.executescript(_SCHEMA)
    finally:
        conn.close()


def _coerce(key: str, value):
    if key == "statutory_eligible":
        return int(bool(value))
    return value


def upsert_invoice(invoice: dict, db_path: str = DEFAULT_DB_PATH) -> None:
    """Insert or update an invoice row, refreshing updated_at."""
    invoice_id = invoice["invoice_id"]
    cols = [c for c in _INVOICE_COLUMNS if c in invoice]
    values = [_coerce(c, invoice[c]) for c in cols]

    conn = get_connection(db_path)
    try:
        with conn:
            exists = conn.execute(
                "SELECT 1 FROM invoices WHERE invoice_id = ?", (invoice_id,)
            ).fetchone()
            if exists:
                set_clause = ", ".join(f"{c} = ?" for c in cols)
                set_clause = (
                    f"{set_clause}, updated_at = datetime('now')"
                    if cols
                    else "updated_at = datetime('now')"
                )
                conn.execute(
                    f"UPDATE invoices SET {set_clause} WHERE invoice_id = ?",
                    [*values, invoice_id],
                )
            else:
                all_cols = ["invoice_id", *cols]
                placeholders = ", ".join("?" for _ in all_cols)
                conn.execute(
                    f"INSERT INTO invoices ({', '.join(all_cols)}) "
                    f"VALUES ({placeholders})",
                    [invoice_id, *values],
                )
    finally:
        conn.close()


def mark_invoice_paid(invoice_id: str, db_path: str = DEFAULT_DB_PATH) -> bool:
    """Set status='paid'. Return True if a row was updated, else False."""
    conn = get_connection(db_path)
    try:
        with conn:
            cur = conn.execute(
                "UPDATE invoices SET status = 'paid', updated_at = datetime('now') "
                "WHERE invoice_id = ?",
                (invoice_id,),
            )
        return cur.rowcount > 0
    finally:
        conn.close()


def get_invoice(invoice_id: str, db_path: str = DEFAULT_DB_PATH) -> dict | None:
    """Return the invoice row as a dict, or None if not found."""
    conn = get_connection(db_path)
    try:
        row = conn.execute(
            "SELECT * FROM invoices WHERE invoice_id = ?", (invoice_id,)
        ).fetchone()
        return dict(row) if row is not None else None
    finally:
        conn.close()


def log_dunning(
    invoice_id: str,
    step: str,
    message: str | None,
    action: str,
    razorpay_id: str | None,
    db_path: str = DEFAULT_DB_PATH,
) -> None:
    """Insert a row into dunning_log."""
    conn = get_connection(db_path)
    try:
        with conn:
            conn.execute(
                "INSERT INTO dunning_log "
                "(invoice_id, step, message_sent, action, razorpay_id) "
                "VALUES (?, ?, ?, ?, ?)",
                (invoice_id, step, message, action, razorpay_id),
            )
    finally:
        conn.close()


def is_event_processed(event_id: str, db_path: str = DEFAULT_DB_PATH) -> bool:
    """Return True if this event_id already exists in webhook_events."""
    conn = get_connection(db_path)
    try:
        row = conn.execute(
            "SELECT 1 FROM webhook_events WHERE event_id = ?", (event_id,)
        ).fetchone()
        return row is not None
    finally:
        conn.close()


def record_event(
    event_id: str,
    event_type: str,
    invoice_id: str | None,
    payload_hash: str,
    db_path: str = DEFAULT_DB_PATH,
) -> None:
    """Insert a row into webhook_events.

    Raises sqlite3.IntegrityError on a duplicate event_id — this is the
    idempotency guard, callers rely on it.
    """
    conn = get_connection(db_path)
    try:
        with conn:
            conn.execute(
                "INSERT INTO webhook_events "
                "(event_id, event_type, invoice_id, payload_hash) VALUES (?, ?, ?, ?)",
                (event_id, event_type, invoice_id, payload_hash),
            )
    finally:
        conn.close()


def add_human_review(
    invoice_id: str,
    reason: str,
    pdf_path: str | None = None,
    xlsx_path: str | None = None,
    db_path: str = DEFAULT_DB_PATH,
) -> None:
    """Insert a row into human_review (status PENDING_HUMAN_APPROVAL)."""
    conn = get_connection(db_path)
    try:
        with conn:
            conn.execute(
                "INSERT INTO human_review (invoice_id, reason, pdf_path, xlsx_path) "
                "VALUES (?, ?, ?, ?)",
                (invoice_id, reason, pdf_path, xlsx_path),
            )
    finally:
        conn.close()
