import pytest

from data.generate_ledger import make_ledger
from evaluation.lift import compute_lift, simulate_recovery
from models import late_payment, ptp_reliability


@pytest.fixture(scope="module", autouse=True)
def _canonical_artifacts():
    make_ledger(n=5000, seed=42)
    late_payment.train()
    ptp_reliability.train()
    yield


@pytest.fixture(scope="module")
def results():
    return compute_lift()


def _toy_invoices():
    return [
        {"amount": 100_000, "ptp": 0.9},
        {"amount": 50_000, "ptp": 0.5},
        {"amount": 200_000, "ptp": 0.7},
        {"amount": 30_000, "ptp": 0.2},
    ]


def test_simulate_recovery_length():
    inv = _toy_invoices()
    curve = simulate_recovery(inv, inv, lambda i: i["ptp"], horizon=90)
    assert len(curve) == 91


def test_simulate_recovery_monotonic_non_decreasing():
    inv = _toy_invoices()
    curve = simulate_recovery(inv, inv, lambda i: i["ptp"], horizon=90)
    assert all(curve[d] >= curve[d - 1] for d in range(1, len(curve)))


def test_simulate_recovery_checkpoints_ordered():
    inv = _toy_invoices()
    curve = simulate_recovery(inv, inv, lambda i: i["ptp"], horizon=90)
    assert curve[90] >= curve[60] >= curve[30]


def test_compute_lift_keys(results):
    assert set(results) == {
        "ai_curve", "base_curve",
        "lift_day_30", "lift_day_60", "lift_day_90",
        "lift_pct_30", "lift_pct_60", "lift_pct_90",
        "n_invoices", "total_at_risk",
    }


def test_lift_grows_over_time(results):
    assert results["lift_day_90"] >= results["lift_day_60"] >= results["lift_day_30"]


def test_ai_beats_baseline_early(results):
    assert results["lift_pct_30"] > 0


def test_ai_curve_ahead_at_horizon(results):
    assert results["ai_curve"][90] > results["base_curve"][90]


def test_has_invoices(results):
    assert results["n_invoices"] > 0


def test_total_at_risk_positive(results):
    assert results["total_at_risk"] > 0


def test_both_curves_start_at_zero(results):
    assert results["ai_curve"][0] == 0.0
    assert results["base_curve"][0] == 0.0
