"""Promise-to-pay (PtP) reliability regressor.

XGBoost regressor predicting the probability a customer keeps a promise-to-pay.
Target: customer_ptp_kept_rate (continuous, [0, 1]).
Saved to models/ptp_reliability.joblib.
"""

from __future__ import annotations

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor

DEFAULT_LEDGER_PATH = "data/synthetic_ledger.csv"
DEFAULT_MODEL_PATH = "models/ptp_reliability.joblib"

TARGET = "customer_ptp_kept_rate"

FEATURES_PTP = [
    "customer_on_time_rate",
    "customer_ptp_history",
    "amount",
    "typical_order_size",
    "size_ratio",
]

_XGB_PARAMS = {
    "n_estimators": 250,
    "max_depth": 3,
    "learning_rate": 0.05,
    "random_state": 42,
}


def _engineer(ledger: pd.DataFrame) -> pd.DataFrame:
    df = ledger.copy()
    df["size_ratio"] = df["amount"] / df["typical_order_size"]
    return df[FEATURES_PTP]


def _feature_frame_for(invoice: dict) -> pd.DataFrame:
    size_ratio = invoice["amount"] / invoice["typical_order_size"]
    row = {
        "customer_on_time_rate": invoice["customer_on_time_rate"],
        "customer_ptp_history": invoice["customer_ptp_history"],
        "amount": invoice["amount"],
        "typical_order_size": invoice["typical_order_size"],
        "size_ratio": size_ratio,
    }
    return pd.DataFrame([row])[FEATURES_PTP]


def train(
    ledger_path: str = DEFAULT_LEDGER_PATH,
    model_path: str = DEFAULT_MODEL_PATH,
) -> dict:
    """Load ledger, train + evaluate the regressor, save the full-data model."""
    ledger = pd.read_csv(ledger_path)
    X = _engineer(ledger)
    y = ledger[TARGET].astype(float)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    reg = XGBRegressor(**_XGB_PARAMS)
    reg.fit(X_train, y_train)

    pred = reg.predict(X_test)
    mae = float(mean_absolute_error(y_test, pred))
    target_std = float(np.std(y_test))

    importances = dict(zip(X.columns, reg.feature_importances_))
    top_feature = max(importances, key=importances.get)

    metrics = {
        "r2": float(r2_score(y_test, pred)),
        "mae": mae,
        "target_std": target_std,
        "mae_vs_std": "PASS" if mae < target_std else "FAIL",
        "top_feature": top_feature,
        "n_train": len(X_train),
        "n_test": len(X_test),
    }

    reg_final = XGBRegressor(**reg.get_params()).fit(X, y)
    joblib.dump(reg_final, model_path)

    print("ptp_reliability metrics:")
    for k, v in metrics.items():
        print(f"  {k}: {v}")
    return metrics


def load_model(model_path: str = DEFAULT_MODEL_PATH):
    """Load the trained regressor."""
    return joblib.load(model_path)


def score_ptp(
    invoice: dict,
    model=None,
    model_path: str = DEFAULT_MODEL_PATH,
) -> float:
    """Return predicted PtP reliability, clipped to [0.0, 1.0]."""
    if model is None:
        model = load_model(model_path)
    pred = float(model.predict(_feature_frame_for(invoice))[0])
    return min(max(pred, 0.0), 1.0)


if __name__ == "__main__":
    train()
