import pandas as pd
import pytest

from data.ingest import ingest, preview_mapping


def test_valid_file_all_rows_pass(fixtures_dir, tmp_path):
    valid, quarantine = ingest(
        str(fixtures_dir / "valid_invoice.csv"), str(tmp_path / "q.csv")
    )
    assert len(valid) == 10
    assert len(quarantine) == 0


def test_tally_headers_mapped(fixtures_dir, tmp_path):
    valid, _ = ingest(
        str(fixtures_dir / "tally_export.csv"), str(tmp_path / "q.csv")
    )
    assert {"invoice_id", "customer_id", "amount", "due_date"}.issubset(valid.columns)
    assert valid.loc[0, "invoice_id"] == "TLY-001"
    assert valid.loc[0, "customer_id"] == "Kumar Textiles"
    assert len(valid) == 10


def test_mixed_file_splits_7_3(fixtures_dir, tmp_path):
    valid, quarantine = ingest(
        str(fixtures_dir / "mixed_invoice.csv"), str(tmp_path / "q.csv")
    )
    assert len(valid) == 7
    assert len(quarantine) == 3


def test_quarantine_has_reason_column(fixtures_dir, tmp_path):
    _, quarantine = ingest(
        str(fixtures_dir / "mixed_invoice.csv"), str(tmp_path / "q.csv")
    )
    assert "quarantine_reason" in quarantine.columns
    reasons = " ".join(quarantine["quarantine_reason"])
    assert "invoice_id" in reasons
    assert "amount" in reasons


def test_quarantine_file_written(fixtures_dir, tmp_path):
    q_path = tmp_path / "q.csv"
    ingest(str(fixtures_dir / "mixed_invoice.csv"), str(q_path))
    assert q_path.is_file()
    on_disk = pd.read_csv(q_path)
    assert len(on_disk) == 3


def test_valid_rows_have_numeric_positive_amount(fixtures_dir, tmp_path):
    valid, _ = ingest(
        str(fixtures_dir / "mixed_invoice.csv"), str(tmp_path / "q.csv")
    )
    assert pd.api.types.is_numeric_dtype(valid["amount"])
    assert (valid["amount"] > 0).all()


def test_missing_file_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        ingest(str(tmp_path / "nope.csv"))


def test_bad_extension_raises(tmp_path):
    p = tmp_path / "invoices.txt"
    p.write_text("Invoice No,Amount\nINV-1,100\n", encoding="utf-8")
    with pytest.raises(ValueError):
        ingest(str(p))


def test_preview_mapping(fixtures_dir):
    preview = preview_mapping(str(fixtures_dir / "valid_invoice.csv"))
    assert preview["mapped"]["Invoice No"] == "invoice_id"
    assert preview["mapped"]["Amount"] == "amount"
    assert set(preview["unmapped"]) == {"Notes", "GST No"}
    assert preview["missing_required"] == []


def test_preview_mapping_flags_missing_required(tmp_path):
    p = tmp_path / "partial.csv"
    p.write_text("Customer,Due Date\nAcme,2026-01-01\n", encoding="utf-8")
    preview = preview_mapping(str(p))
    assert set(preview["missing_required"]) == {"invoice_id", "amount"}


def test_ingest_is_idempotent(fixtures_dir, tmp_path):
    q_path = str(tmp_path / "q.csv")
    v1, q1 = ingest(str(fixtures_dir / "mixed_invoice.csv"), q_path)
    v2, q2 = ingest(str(fixtures_dir / "mixed_invoice.csv"), q_path)
    assert len(v1) == len(v2) == 7
    assert len(q1) == len(q2) == 3
    assert len(pd.read_csv(q_path)) == 3
