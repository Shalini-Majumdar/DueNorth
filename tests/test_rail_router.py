import pytest

from engines.rail_router import route_payment


def test_small_amount_uses_payment_link():
    r = route_payment({"invoice_id": "INV-1", "amount": 50_000})
    assert r["rail"] == "payment_link"
    assert r["amount_paise"] == 5_000_000


def test_exactly_one_lakh_uses_payment_link():
    r = route_payment({"invoice_id": "INV-2", "amount": 100_000})
    assert r["rail"] == "payment_link"


def test_just_over_one_lakh_uses_smart_collect():
    r = route_payment({"invoice_id": "INV-3", "amount": 100_001})
    assert r["rail"] == "smart_collect"


def test_smart_collect_without_upi_sc_shows_coming_soon():
    r = route_payment(
        {"invoice_id": "INV-4", "amount": 500_000, "upi_sc_available": False}
    )
    assert r["upi_status"] == "coming_soon"


def test_smart_collect_with_upi_sc_omits_upi_status():
    r = route_payment(
        {"invoice_id": "INV-5", "amount": 500_000, "upi_sc_available": True}
    )
    assert "upi_status" not in r


def test_zero_amount_raises():
    with pytest.raises(ValueError):
        route_payment({"invoice_id": "INV-6", "amount": 0})


def test_negative_amount_raises():
    with pytest.raises(ValueError):
        route_payment({"invoice_id": "INV-7", "amount": -1000})


def test_missing_invoice_id_raises():
    with pytest.raises(ValueError):
        route_payment({"amount": 5000})


def test_dry_run_flag_is_reported():
    r = route_payment({"invoice_id": "INV-8", "amount": 5000}, dry_run=True)
    assert r["dry_run"] is True


def test_amount_paise_is_integer():
    r = route_payment({"invoice_id": "INV-9", "amount": 1234.56})
    assert isinstance(r["amount_paise"], int)
    assert r["amount_paise"] == 123_456

    r2 = route_payment({"invoice_id": "INV-10", "amount": 250_000.10})
    assert isinstance(r2["amount_paise"], int)
    assert r2["amount_paise"] == 25_000_010
