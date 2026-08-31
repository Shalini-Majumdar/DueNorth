"""Smoke tests for the functions app/dashboard.py depends on.

Streamlit is intentionally never imported here — importing it under pytest is
slow and brittle. The dashboard is a thin view over these functions.
"""

from datetime import date

import pandas as pd
import pytest

from data.generate_ledger import make_ledger
from engines.interest import section16_interest
from evaluation.lift import compute_lift, overdue_invoices
from models import late_payment, ptp_reliability

LEDGER_PATH = "data/synthetic_ledger.csv"


@pytest.fixture(scope="module", autouse=True)
def _canonical_artifacts():
    make_ledger(n=5000, seed=42)
    late_payment.train()
    ptp_reliability.train()
    yield


def test_late_model_loads_with_predict_proba():
    model = late_payment.load_model()
    assert hasattr(model, "predict_proba")


def test_ptp_model_loads_with_predict():
    model = ptp_reliability.load_model()
    assert hasattr(model, "predict")


def test_compute_lift_smoke():
    results = compute_lift()
    assert isinstance(results, dict)
    assert len(results["ai_curve"]) == 91
    assert len(results["base_curve"]) == 91
    assert results["n_invoices"] > 0


def test_interest_calc_with_dashboard_style_inputs():
    due_date = date(2026, 5, 1)
    result = section16_interest(500_000.0, due_date, date(2026, 7, 30))
    assert set(result) >= {
        "principal", "interest", "total_due", "statutory_rate_pa", "schedule"
    }
    assert result["total_due"] >= result["principal"]
    assert len(result["schedule"]) >= 1


def test_ledger_loads_and_filters_overdue():
    ledger = pd.read_csv(LEDGER_PATH)
    overdue = overdue_invoices(ledger)
    assert len(overdue) > 0
    assert (overdue["days_past_due"] > 0).all()
    assert (overdue["status"] != "paid").all()
