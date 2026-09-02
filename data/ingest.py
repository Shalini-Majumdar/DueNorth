"""Supplier invoice ingestion.

Reads a CSV / Excel export, maps non-standard headers to the DueNorth schema,
and quarantines bad rows (with a reason) instead of dropping them silently.
"""

from __future__ import annotations

import os

import pandas as pd

COLUMN_MAP = {
    "Invoice No": "invoice_id",
    "Invoice Number": "invoice_id",
    "Voucher No": "invoice_id",
    "Customer": "customer_id",
    "Party Name": "customer_id",
    "Buyer": "customer_id",
    "Amount": "amount",
    "Invoice Amount": "amount",
    "Total": "amount",
    "Due Date": "due_date",
    "Payment Due Date": "due_date",
    "Paid Date": "actual_paid_date",
    "Payment Date": "actual_paid_date",
    "Date Paid": "actual_paid_date",
}

REQUIRED_COLUMNS = ["invoice_id", "amount"]

_VALID_EXTENSIONS = (".csv", ".xlsx", ".xls")

# case-insensitive lookup: normalised header -> canonical schema name
_NORMALISED_MAP = {k.strip().lower(): v for k, v in COLUMN_MAP.items()}


def _read_any(path: str) -> pd.DataFrame:
    ext = os.path.splitext(path)[1].lower()
    if ext == ".csv":
        return pd.read_csv(path, dtype=str)
    if ext in (".xlsx", ".xls"):
        return pd.read_excel(path, dtype=str)
    raise ValueError(
        f"Unsupported file extension {ext!r}; expected one of {_VALID_EXTENSIONS}."
    )


def _rename_columns(columns) -> dict:
    """Map source headers -> schema names, keeping the first hit per target."""
    rename = {}
    taken = set()
    for col in columns:
        target = _NORMALISED_MAP.get(str(col).strip().lower())
        if target and target not in taken:
            rename[col] = target
            taken.add(target)
    return rename


def _is_blank(value) -> bool:
    return pd.isna(value) or str(value).strip() == ""


def ingest(
    path: str,
    quarantine_path: str = "data/quarantine.csv",
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Ingest an invoice export into (valid_df, quarantine_df).

    A row is quarantined if invoice_id is missing/empty, or amount is missing,
    non-numeric, or <= 0. Quarantined rows are written to quarantine_path with a
    "quarantine_reason" column. Never raises on bad row data.
    """
    if not os.path.isfile(path):
        raise FileNotFoundError(path)

    df = _read_any(path)
    df = df.rename(columns=_rename_columns(df.columns))

    has_invoice_id = "invoice_id" in df.columns
    has_amount = "amount" in df.columns

    amount_numeric = (
        pd.to_numeric(df["amount"], errors="coerce")
        if has_amount
        else pd.Series([pd.NA] * len(df), index=df.index)
    )

    reasons: list[str] = []
    for i in df.index:
        row_reasons = []
        if not has_invoice_id or _is_blank(df.at[i, "invoice_id"]):
            row_reasons.append("missing invoice_id")
        if not has_amount or _is_blank(df.at[i, "amount"]):
            row_reasons.append("missing amount")
        elif pd.isna(amount_numeric.at[i]):
            row_reasons.append("non-numeric amount")
        elif amount_numeric.at[i] <= 0:
            row_reasons.append("amount <= 0")
        reasons.append("; ".join(row_reasons))

    reason_series = pd.Series(reasons, index=df.index)
    bad_mask = reason_series != ""

    valid_df = df.loc[~bad_mask].copy()
    if "amount" in valid_df.columns:
        valid_df["amount"] = pd.to_numeric(valid_df["amount"])
    valid_df = valid_df.reset_index(drop=True)

    quarantine_df = df.loc[bad_mask].copy()
    quarantine_df["quarantine_reason"] = reason_series.loc[bad_mask]
    quarantine_df = quarantine_df.reset_index(drop=True)

    parent = os.path.dirname(quarantine_path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    quarantine_df.to_csv(quarantine_path, index=False)

    return valid_df, quarantine_df


def preview_mapping(path: str) -> dict:
    """Report which headers were found and how they map to the schema."""
    if not os.path.isfile(path):
        raise FileNotFoundError(path)

    ext = os.path.splitext(path)[1].lower()
    if ext not in _VALID_EXTENSIONS:
        raise ValueError(
            f"Unsupported file extension {ext!r}; expected one of {_VALID_EXTENSIONS}."
        )

    df = _read_any(path).head(0)
    detected = list(df.columns)
    rename = _rename_columns(df.columns)
    mapped = {col: rename[col] for col in detected if col in rename}
    unmapped = [col for col in detected if col not in rename]
    missing_required = [
        req for req in REQUIRED_COLUMNS if req not in mapped.values()
    ]
    return {
        "detected": detected,
        "mapped": mapped,
        "unmapped": unmapped,
        "missing_required": missing_required,
    }
