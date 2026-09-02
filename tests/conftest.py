"""Shared fixtures for the DueNorth test suite.

Generates the three ingestion fixture files under tests/fixtures/ once per
session so tests/test_ingest.py has deterministic input.
"""

from pathlib import Path

import pytest

FIXTURES_DIR = Path(__file__).parent / "fixtures"

_VALID_INVOICE = """Invoice No,Customer,Amount,Due Date,Notes,GST No
INV-1001,Acme Traders,50000,2026-01-15,priority,27ABCDE1234F1Z5
INV-1002,Bright Mfg,75000,2026-02-01,,27ABCDE1234F1Z6
INV-1003,Coastal Foods,32000,2026-02-05,repeat,27ABCDE1234F1Z7
INV-1004,Delta Rubber,128500,2026-02-10,,27ABCDE1234F1Z8
INV-1005,Everest Steel,64000,2026-02-14,,27ABCDE1234F1Z9
INV-1006,Frontier Auto,45500,2026-02-18,rush,27ABCDE1234F1ZA
INV-1007,Gagan Pharma,210000,2026-02-22,,27ABCDE1234F1ZB
INV-1008,Himalaya Wires,18750,2026-02-26,,27ABCDE1234F1ZC
INV-1009,Indus Looms,97300,2026-03-02,,27ABCDE1234F1ZD
INV-1010,Jyoti Plastics,55000,2026-03-06,,27ABCDE1234F1ZE
"""

_TALLY_EXPORT = """Voucher No,Party Name,Total,Payment Due Date
TLY-001,Kumar Textiles,120000,2026-03-01
TLY-002,Lotus Ceramics,44000,2026-03-04
TLY-003,Mehta Exports,86500,2026-03-08
TLY-004,Nandi Motors,153000,2026-03-12
TLY-005,Orient Chem,29900,2026-03-16
TLY-006,Prakash Iron,71200,2026-03-20
TLY-007,Quantum Tools,38400,2026-03-24
TLY-008,Ravi Agro,64750,2026-03-28
TLY-009,Sagar Marine,99000,2026-04-01
TLY-010,Tanvi Foods,47600,2026-04-05
"""

# 7 valid, 3 bad: empty invoice_id, amount 0, amount "N/A"
_MIXED_INVOICE = """Invoice No,Customer,Amount,Due Date
INV-2001,Alpha Co,45000,2026-01-10
INV-2002,Beta Co,60000,2026-01-12
INV-2003,Gamma Co,30000,2026-01-15
INV-2004,Delta Co,90000,2026-01-18
INV-2005,Epsilon Co,15000,2026-01-20
INV-2006,Zeta Co,80000,2026-01-22
INV-2007,Eta Co,55000,2026-01-25
,Theta Co,70000,2026-01-28
INV-2009,Iota Co,0,2026-01-30
INV-2010,Kappa Co,N/A,2026-02-01
"""


@pytest.fixture(scope="session", autouse=True)
def _generate_ingest_fixtures():
    FIXTURES_DIR.mkdir(exist_ok=True)
    (FIXTURES_DIR / "valid_invoice.csv").write_text(_VALID_INVOICE, encoding="utf-8")
    (FIXTURES_DIR / "tally_export.csv").write_text(_TALLY_EXPORT, encoding="utf-8")
    (FIXTURES_DIR / "mixed_invoice.csv").write_text(_MIXED_INVOICE, encoding="utf-8")
    yield


@pytest.fixture
def fixtures_dir() -> Path:
    return FIXTURES_DIR
