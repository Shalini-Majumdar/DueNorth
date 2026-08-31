import os

import pytest

from data.generate_ledger import make_ledger
from models import late_payment, ptp_reliability

LATE_PATH = "models/late_payment.joblib"
PTP_PATH = "models/ptp_reliability.joblib"


@pytest.fixture(scope="module", autouse=True)
def _canonical_artifacts():
    """Restore the full 5000-row ledger and ensure both models are trained.

    Other test modules mutate data/synthetic_ledger.csv, so regenerate it here
    to keep this module order-independent.
    """
    make_ledger(n=5000, seed=42)
    if not os.path.isfile(LATE_PATH):
        late_payment.train()
    if not os.path.isfile(PTP_PATH):
        ptp_reliability.train()
    yield


# --- late_payment -----------------------------------------------------------

@pytest.fixture(scope="module")
def late_metrics():
    return late_payment.train()


def test_late_train_returns_all_metric_keys(late_metrics):
    assert set(late_metrics) == {
        "precision", "recall", "f1", "auroc",
        "top_feature", "n_train", "n_test",
    }


def test_late_auroc_above_chance(late_metrics):
    assert late_metrics["auroc"] > 0.5


def test_late_classification_metrics_in_unit_range(late_metrics):
    for key in ("precision", "recall", "f1"):
        assert 0.0 <= late_metrics[key] <= 1.0


def test_late_joblib_written():
    assert os.path.isfile(LATE_PATH)


def test_late_load_model_has_predict_proba():
    model = late_payment.load_model()
    assert hasattr(model, "predict_proba")


def test_score_invoice_returns_unit_float():
    inv = {
        "amount": 90_000, "typical_order_size": 85_000,
        "customer_on_time_rate": 0.6, "customer_ptp_kept_rate": 0.6,
        "customer_ptp_history": 8, "sector": "electronics",
    }
    p = late_payment.score_invoice(inv)
    assert isinstance(p, float)
    assert 0.0 <= p <= 1.0


def test_score_invoice_high_risk():
    inv = {
        "amount": 250_000, "typical_order_size": 90_000,
        "customer_on_time_rate": 0.1, "customer_ptp_kept_rate": 0.15,
        "customer_ptp_history": 2, "sector": "construction",
    }
    assert late_payment.score_invoice(inv) > 0.5


def test_score_invoice_low_risk():
    inv = {
        "amount": 70_000, "typical_order_size": 75_000,
        "customer_on_time_rate": 0.95, "customer_ptp_kept_rate": 0.95,
        "customer_ptp_history": 20, "sector": "pharma",
    }
    assert late_payment.score_invoice(inv) < 0.7


def test_top_feature_is_legitimate_signal(late_metrics):
    assert late_metrics["top_feature"] in ("customer_on_time_rate", "size_ratio")


def test_no_forbidden_features_in_model():
    model = late_payment.load_model()
    names = set(map(str, model.feature_names_in_))
    assert names.isdisjoint(late_payment.FORBIDDEN)


# --- ptp_reliability -------------------------------------------------------

@pytest.fixture(scope="module")
def ptp_metrics():
    return ptp_reliability.train()


def test_ptp_train_returns_all_metric_keys(ptp_metrics):
    assert {"r2", "mae", "target_std", "mae_vs_std", "top_feature"}.issubset(ptp_metrics)


def test_ptp_mae_beats_target_std(ptp_metrics):
    assert ptp_metrics["mae_vs_std"] == "PASS"


def test_ptp_joblib_written():
    assert os.path.isfile(PTP_PATH)


def test_score_ptp_returns_unit_float():
    inv = {
        "amount": 90_000, "typical_order_size": 85_000,
        "customer_on_time_rate": 0.6, "customer_ptp_history": 8,
    }
    p = ptp_reliability.score_ptp(inv)
    assert isinstance(p, float)
    assert 0.0 <= p <= 1.0


def test_score_ptp_high_reliability():
    inv = {
        "amount": 70_000, "typical_order_size": 75_000,
        "customer_on_time_rate": 0.95, "customer_ptp_history": 20,
    }
    assert ptp_reliability.score_ptp(inv) > 0.6


def test_score_ptp_low_reliability():
    inv = {
        "amount": 200_000, "typical_order_size": 80_000,
        "customer_on_time_rate": 0.1, "customer_ptp_history": 2,
    }
    assert ptp_reliability.score_ptp(inv) < 0.6


def test_ptp_predictions_clipped_to_unit_interval():
    import pandas as pd

    ledger = pd.read_csv("data/synthetic_ledger.csv")
    preds = [
        ptp_reliability.score_ptp(row)
        for row in ledger.head(200).to_dict("records")
    ]
    assert all(0.0 <= p <= 1.0 for p in preds)
