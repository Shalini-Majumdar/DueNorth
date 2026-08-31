from datetime import date

import pytest

from engines.interest import (
    appointed_day,
    appropriate_payment,
    section16_interest,
)

# --- section16_interest anchors -------------------------------------------------

def test_anchor_one_million_one_year():
    # 12 full monthly rests, no stub. Spec's algorithm (monthly_rate = 3*0.055/12
    # = 0.01375, compounded monthly) => 1_000_000 * (1.01375**12 - 1).
    r = section16_interest(1_000_000, date(2026, 1, 1), date(2027, 1, 1))
    assert r["interest"] == pytest.approx(178_068.13, abs=1.0)
    assert r["total_due"] == pytest.approx(1_178_068.13, abs=1.0)
    assert r["bank_rate_used"] == 0.055
    assert r["statutory_rate_pa"] == pytest.approx(0.165)


def test_anchor_partial_year_with_stub():
    r = section16_interest(500_000, date(2026, 3, 31), date(2026, 8, 15))
    assert 30_000 <= r["interest"] <= 34_000


def test_schedule_length_matches_monthly_rests():
    # ~3 month period: 3 entries (2 full + 1 stub).
    r = section16_interest(100_000, date(2026, 1, 1), date(2026, 3, 20))
    assert len(r["schedule"]) == 3
    # A clean 3-month period: 3 full entries.
    r2 = section16_interest(100_000, date(2026, 1, 1), date(2026, 4, 1))
    assert len(r2["schedule"]) == 3


def test_schedule_compounds_forward():
    r = section16_interest(100_000, date(2026, 1, 1), date(2026, 4, 1))
    balances = [row["opening_balance"] for row in r["schedule"]]
    assert balances[0] == 100_000
    assert balances[1] > balances[0]
    assert balances[2] > balances[1]


def test_no_accrual_when_end_not_after_start():
    r = section16_interest(100_000, date(2026, 1, 1), date(2026, 1, 1))
    assert r["interest"] == 0
    assert r["total_due"] == 100_000
    assert r["schedule"] == []


# --- appointed_day anchors -----------------------------------------------------

def test_appointed_day_no_agreement():
    assert appointed_day(date(2026, 1, 1), None) == date(2026, 1, 17)


def test_appointed_day_with_agreement():
    assert appointed_day(date(2026, 1, 1), 30) == date(2026, 2, 1)


def test_appointed_day_caps_at_45():
    assert appointed_day(date(2026, 1, 1), 60) == date(2026, 2, 16)


# --- appropriate_payment anchors ---------------------------------------------

def test_payment_covers_interest_and_part_principal():
    r = appropriate_payment(10_000, 8_000, 50_000)
    assert r["applied_to_interest"] == 8_000
    assert r["applied_to_principal"] == 2_000
    assert r["interest_remaining"] == 0
    assert r["principal_remaining"] == 48_000


def test_payment_short_of_interest():
    r = appropriate_payment(3_000, 8_000, 50_000)
    assert r["applied_to_interest"] == 3_000
    assert r["applied_to_principal"] == 0
    assert r["interest_remaining"] == 5_000
    assert r["principal_remaining"] == 50_000
