"""Late-payment classifier.

XGBoost binary classifier predicting whether an invoice will be paid late.
Trained on the synthetic ledger, saved to models/late_payment.joblib.

Target leakage guard: the columns days_past_due, actual_paid_date, status,
partial_paid_amount and is_late are the label / post-hoc outcome and must never
be used as features.
"""

from __future__ import annotations

import joblib
import pandas as pd
from sklearn.metrics import (
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

DEFAULT_LEDGER_PATH = "data/synthetic_ledger.csv"
DEFAULT_MODEL_PATH = "models/late_payment.joblib"

FORBIDDEN = {
    "days_past_due",
    "actual_paid_date",
    "status",
    "partial_paid_amount",
    "is_late",
}

NUMERIC_FEATURES = [
    "amount",
    "typical_order_size",
    "size_ratio",
    "customer_on_time_rate",
    "customer_ptp_kept_rate",
    "customer_ptp_history",
]

FEATURES = NUMERIC_FEATURES  # sector_* dummy columns are appended at fit time

_XGB_PARAMS = {
    "n_estimators": 300,
    "max_depth": 4,
    "learning_rate": 0.05,
    "subsample": 0.9,
    "eval_metric": "logloss",
    "random_state": 42,
}

# Split-count ("weight") importance: reflects how pervasively a feature is used
# across the ensemble. Continuous customer-reliability signals dominate here,
# which is also the leakage sanity check (see tests/test_models.py).
_IMPORTANCE_TYPE = "weight"


def _engineer(ledger: pd.DataFrame) -> pd.DataFrame:
    df = ledger.copy()
    df["size_ratio"] = df["amount"] / df["typical_order_size"]
    dummies = pd.get_dummies(df["sector"], prefix="sector")
    features = pd.concat([df[NUMERIC_FEATURES], dummies], axis=1)
    return features


def _feature_frame_for(invoice: dict, feature_names: list[str]) -> pd.DataFrame:
    size_ratio = invoice["amount"] / invoice["typical_order_size"]
    row = {
        "amount": invoice["amount"],
        "typical_order_size": invoice["typical_order_size"],
        "size_ratio": size_ratio,
        "customer_on_time_rate": invoice["customer_on_time_rate"],
        "customer_ptp_kept_rate": invoice["customer_ptp_kept_rate"],
        "customer_ptp_history": invoice["customer_ptp_history"],
    }
    for name in feature_names:
        if name.startswith("sector_"):
            row[name] = 1.0 if name == f"sector_{invoice['sector']}" else 0.0
    return pd.DataFrame([row])[feature_names]


def train(
    ledger_path: str = DEFAULT_LEDGER_PATH,
    model_path: str = DEFAULT_MODEL_PATH,
) -> dict:
    """Load ledger, engineer features, train + evaluate, save full-data model."""
    ledger = pd.read_csv(ledger_path)
    assert FORBIDDEN.isdisjoint(_engineer(ledger).columns), "leakage detected"

    X = _engineer(ledger)
    y = ledger["is_late"].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )

    clf = XGBClassifier(importance_type=_IMPORTANCE_TYPE, **_XGB_PARAMS)
    clf.fit(X_train, y_train)

    proba = clf.predict_proba(X_test)[:, 1]
    pred = (proba >= 0.5).astype(int)

    importances = dict(zip(X.columns, clf.feature_importances_))
    top_feature = max(importances, key=importances.get)

    metrics = {
        "precision": float(precision_score(y_test, pred, zero_division=0)),
        "recall": float(recall_score(y_test, pred, zero_division=0)),
        "f1": float(f1_score(y_test, pred, zero_division=0)),
        "auroc": float(roc_auc_score(y_test, proba)),
        "top_feature": top_feature,
        "n_train": len(X_train),
        "n_test": len(X_test),
    }

    clf_final = XGBClassifier(**clf.get_params()).fit(X, y)
    joblib.dump(clf_final, model_path)

    print("late_payment metrics:")
    for k, v in metrics.items():
        print(f"  {k}: {v}")
    return metrics


def load_model(model_path: str = DEFAULT_MODEL_PATH):
    """Load the trained classifier. Call once at app startup."""
    return joblib.load(model_path)


def score_invoice(
    invoice: dict,
    model=None,
    model_path: str = DEFAULT_MODEL_PATH,
) -> float:
    """Return P(late) in [0.0, 1.0] for a single invoice dict."""
    if model is None:
        model = load_model(model_path)
    feature_names = list(model.feature_names_in_)
    X = _feature_frame_for(invoice, feature_names)
    proba = float(model.predict_proba(X)[0, 1])
    return min(max(proba, 0.0), 1.0)


if __name__ == "__main__":
    train()
