import pytest

from engines.udyam import onboard


def test_micro_valid_urn():
    out = onboard({"udyam_status": "Micro", "udyam_number": "UDYAM-MH-12-0001234"})
    assert out["flow"] == "full"
    assert out["statutory_eligible"] is True


def test_small_valid_urn():
    out = onboard({"udyam_status": "Small", "udyam_number": "UDYAM-DL-07-9876543"})
    assert out["flow"] == "full"
    assert out["statutory_eligible"] is True


def test_medium_with_valid_urn():
    out = onboard({"udyam_status": "Medium", "udyam_number": "UDYAM-MH-12-0001234"})
    assert out["flow"] == "reminders_only"
    assert out["statutory_eligible"] is False


def test_medium_no_urn():
    out = onboard({"udyam_status": "Medium"})
    assert out["flow"] == "reminders_only"
    assert out["statutory_eligible"] is False


def test_not_registered():
    out = onboard({"udyam_status": "not_registered", "udyam_number": ""})
    assert out["flow"] == "reminders_only"
    assert out["statutory_eligible"] is False


def test_micro_missing_urn_raises():
    with pytest.raises(ValueError):
        onboard({"udyam_status": "Micro"})


def test_micro_lowercase_urn_raises():
    with pytest.raises(ValueError):
        onboard({"udyam_status": "Micro", "udyam_number": "UDYAM-mh-12-0001234"})


def test_micro_short_serial_raises():
    with pytest.raises(ValueError):
        onboard({"udyam_status": "Micro", "udyam_number": "UDYAM-MH-12-123"})


def test_small_empty_string_urn_raises():
    with pytest.raises(ValueError):
        onboard({"udyam_status": "Small", "udyam_number": ""})


def test_valid_urn_with_whitespace_is_stripped():
    out = onboard(
        {"udyam_status": "Micro", "udyam_number": " UDYAM-MH-12-0001234 "}
    )
    assert out["flow"] == "full"
    assert out["statutory_eligible"] is True
    assert out["udyam_number"] == "UDYAM-MH-12-0001234"
