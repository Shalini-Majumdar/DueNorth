"""POST /api/onboard — the Udyam gate mounted as an HTTP endpoint."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api import db, routes


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = str(tmp_path / "onboard.db")
    monkeypatch.setattr(routes, "DB_PATH", db_path)
    app = FastAPI()
    app.include_router(routes.router)
    with TestClient(app) as c:
        c.db_path = db_path
        yield c


def test_small_supplier_with_valid_urn_gets_full_flow(client):
    r = client.post(
        "/api/onboard",
        json={
            "name": "Sharma Textiles",
            "udyam_status": "Small",
            "udyam_number": "UDYAM-MH-12-0001234",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["flow"] == "full"
    assert body["statutory_eligible"] is True
    assert "Section 16" in body["explanation"]


def test_medium_supplier_is_reminders_only(client):
    r = client.post(
        "/api/onboard",
        json={"name": "Kamal Engineering", "udyam_status": "Medium"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["flow"] == "reminders_only"
    assert body["statutory_eligible"] is False
    assert "reminders only" in body["explanation"]


def test_unregistered_supplier_is_reminders_only(client):
    r = client.post(
        "/api/onboard",
        json={"name": "Anon Traders", "udyam_status": "not_registered"},
    )
    assert r.status_code == 200
    assert r.json()["flow"] == "reminders_only"


def test_small_supplier_with_malformed_urn_is_rejected(client):
    r = client.post(
        "/api/onboard",
        json={
            "name": "Sharma Textiles",
            "udyam_status": "Small",
            "udyam_number": "UDYAM-123",
        },
    )
    assert r.status_code == 422
    assert "Udyam Registration Number" in r.json()["detail"]


def test_small_supplier_with_no_urn_is_rejected(client):
    r = client.post(
        "/api/onboard",
        json={"name": "Sharma Textiles", "udyam_status": "Small"},
    )
    assert r.status_code == 422


def test_unknown_status_is_rejected(client):
    r = client.post(
        "/api/onboard", json={"name": "X", "udyam_status": "Enormous"}
    )
    assert r.status_code == 422


def test_onboarding_persists_and_is_readable(client):
    client.post(
        "/api/onboard",
        json={"name": "Kamal Engineering", "udyam_status": "Medium"},
    )
    stored = db.get_supplier(db_path=client.db_path)
    assert stored["name"] == "Kamal Engineering"
    assert stored["statutory_eligible"] is False

    r = client.get("/api/supplier")
    assert r.status_code == 200
    assert r.json()["onboarded"] is True
    assert r.json()["flow"] == "reminders_only"


def test_onboarding_twice_updates_rather_than_duplicates(client):
    client.post(
        "/api/onboard",
        json={
            "name": "First",
            "udyam_status": "Small",
            "udyam_number": "UDYAM-MH-12-0001234",
        },
    )
    client.post(
        "/api/onboard", json={"name": "Second", "udyam_status": "Medium"}
    )
    conn = db.get_connection(client.db_path)
    try:
        rows = conn.execute("SELECT * FROM suppliers").fetchall()
    finally:
        conn.close()
    assert len(rows) == 1
    assert rows[0]["name"] == "Second"
    assert rows[0]["flow"] == "reminders_only"


def test_supplier_endpoint_reports_fallback_before_onboarding(client):
    r = client.get("/api/supplier")
    assert r.status_code == 200
    assert r.json()["onboarded"] is False
