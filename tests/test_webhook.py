import hashlib
import hmac
import json
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from api import db, webhook

SECRET = "test_secret"


def make_signature(body: bytes, secret: str) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


@pytest.fixture
def ctx(tmp_path, monkeypatch):
    dbp = str(tmp_path / "wh.db")
    monkeypatch.setattr(webhook, "DB_PATH", dbp)
    monkeypatch.setenv("RAZORPAY_WEBHOOK_SECRET", SECRET)
    db.init_db(dbp)
    with TestClient(webhook.app) as client:
        yield client, dbp


def seed_invoice(dbp, invoice_id="INV000001", status="unpaid", amount=50_000.0):
    db.upsert_invoice(
        {
            "invoice_id": invoice_id,
            "customer_id": "CUST0001",
            "amount": amount,
            "days_past_due": 10,
            "status": status,
            "statutory_eligible": True,
        },
        dbp,
    )


def post_event(client, body: dict, event_id="evt_1", secret=SECRET, signature=None):
    raw = json.dumps(body).encode()
    sig = signature if signature is not None else make_signature(raw, secret)
    headers = {"x-razorpay-event-id": event_id}
    if sig is not None:
        headers["x-razorpay-signature"] = sig
    return client.post("/webhook", content=raw, headers=headers)


def captured_payload(invoice_id="INV000001", event="payment.captured"):
    return {
        "event": event,
        "payload": {"payment": {"entity": {"notes": {"invoice_id": invoice_id}}}},
    }


def link_payload(invoice_id="INV000001", event="payment_link.paid"):
    return {
        "event": event,
        "payload": {"payment_link": {"entity": {"reference_id": invoice_id}}},
    }


def dunning_rows(dbp, invoice_id):
    conn = db.get_connection(dbp)
    try:
        return conn.execute(
            "SELECT * FROM dunning_log WHERE invoice_id = ?", (invoice_id,)
        ).fetchall()
    finally:
        conn.close()


def test_valid_payment_captured_returns_200(ctx):
    client, dbp = ctx
    seed_invoice(dbp)
    r = post_event(client, captured_payload())
    assert r.status_code == 200
    assert db.get_invoice("INV000001", dbp)["status"] == "paid"


def test_tampered_signature_returns_400(ctx):
    client, _ = ctx
    r = post_event(client, captured_payload(), signature="deadbeef")
    assert r.status_code == 400


def test_missing_signature_returns_400(ctx):
    client, _ = ctx
    raw = json.dumps(captured_payload()).encode()
    r = client.post("/webhook", content=raw, headers={"x-razorpay-event-id": "evt_x"})
    assert r.status_code == 400


def test_duplicate_event_id_processed_once(ctx):
    client, dbp = ctx
    seed_invoice(dbp)
    r1 = post_event(client, captured_payload(), event_id="evt_dup")
    r2 = post_event(client, captured_payload(), event_id="evt_dup")
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r2.json() == {"status": "already_processed"}

    conn = db.get_connection(dbp)
    try:
        n_events = conn.execute(
            "SELECT COUNT(*) c FROM webhook_events WHERE event_id = ?", ("evt_dup",)
        ).fetchone()["c"]
    finally:
        conn.close()
    assert n_events == 1
    captured = [r for r in dunning_rows(dbp, "INV000001") if r["action"] == "payment_captured"]
    assert len(captured) == 1


def test_payment_link_paid_marks_invoice_paid(ctx):
    client, dbp = ctx
    seed_invoice(dbp)
    r = post_event(client, link_payload(event="payment_link.paid"))
    assert r.status_code == 200
    assert db.get_invoice("INV000001", dbp)["status"] == "paid"


def test_link_expired_on_unpaid_renews_link(ctx, monkeypatch):
    client, dbp = ctx
    seed_invoice(dbp, status="unpaid")
    mock = Mock(return_value={"rail": "payment_link", "id": "plink_new", "url": "https://rzp.io/new"})
    monkeypatch.setattr(webhook, "live_route_payment", mock)

    r = post_event(client, link_payload(event="payment_link.expired"))
    assert r.status_code == 200
    assert mock.call_count == 1
    renewed = [r for r in dunning_rows(dbp, "INV000001") if r["action"] == "link_renewed"]
    assert len(renewed) == 1


def test_link_expired_on_paid_does_not_renew(ctx, monkeypatch):
    client, dbp = ctx
    seed_invoice(dbp, status="paid")
    mock = Mock()
    monkeypatch.setattr(webhook, "live_route_payment", mock)

    r = post_event(client, link_payload(event="payment_link.expired"))
    assert r.status_code == 200
    mock.assert_not_called()


def test_payment_failed_logs_and_leaves_status(ctx):
    client, dbp = ctx
    seed_invoice(dbp, status="unpaid")
    r = post_event(client, captured_payload(event="payment.failed"))
    assert r.status_code == 200
    assert db.get_invoice("INV000001", dbp)["status"] == "unpaid"
    failed = [r for r in dunning_rows(dbp, "INV000001") if r["action"] == "payment_failed"]
    assert len(failed) == 1


def test_unknown_event_type_returns_200(ctx):
    client, _ = ctx
    r = post_event(client, {"event": "foo.bar", "payload": {}})
    assert r.status_code == 200


def test_event_without_invoice_id_does_not_crash(ctx):
    client, _ = ctx
    body = {"event": "payment.captured", "payload": {"payment": {"entity": {"notes": {}}}}}
    r = post_event(client, body)
    assert r.status_code == 200
