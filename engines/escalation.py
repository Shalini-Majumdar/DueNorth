"""MSEFC / Samadhaan pre-fill generator.

Produces a DRAFT PDF demand notice and an Excel Samadhaan pre-fill sheet.
It NEVER files anything and NEVER sends anything - it always returns
PENDING_HUMAN_APPROVAL. Only callable for statutory_eligible (flow == "full")
suppliers.
"""

import os

from openpyxl import Workbook
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

DRAFT_MARKER = "*** DRAFT — REQUIRES HUMAN REVIEW — NOT FILED ***"

XLSX_COLUMNS = [
    "supplier_name",
    "udyam_number",
    "buyer_name",
    "invoice_id",
    "principal_inr",
    "interest_inr",
    "total_due_inr",
    "appointed_day",
    "statutory_rate_pct",
    "bank_rate_pct",
    "legal_basis",
]


def _legal_basis(bank_rate_used: float) -> str:
    return (
        "MSMED Act 2006 ss.15-16; compound interest at 3x RBI Bank Rate "
        f"(currently {bank_rate_used * 100:.1f}%) with monthly rests"
    )


def _write_pdf(path, invoice, supplier, interest_result, legal_basis):
    c = canvas.Canvas(path, pagesize=A4, pageCompression=0)
    _width, height = A4
    y = height - 60
    line_height = 18

    def line(text):
        nonlocal y
        c.drawString(50, y, str(text))
        y -= line_height

    line("DEMAND NOTICE — MSMED Act 2006")
    line("")
    line(f"Supplier: {supplier['name']}")
    line(f"Udyam Registration Number: {supplier['udyam_number']}")
    line(f"Buyer: {invoice['buyer_name']}")
    line(f"Invoice ID: {invoice['invoice_id']}")
    line(f"Invoice amount (principal): Rs {float(invoice['amount']):,.2f}")
    line(f"Due date: {invoice['due_date']}")
    line(f"Appointed day (interest accrual start): {invoice['appointed_day']}")
    line("")
    line(f"Statutory interest accrued: Rs {interest_result['interest']:,.2f}")
    line(f"Total amount now due: Rs {interest_result['total_due']:,.2f}")
    line(
        f"Statutory rate: {interest_result['statutory_rate_pa'] * 100:.2f}% p.a. "
        f"(3x RBI Bank Rate of {interest_result['bank_rate_used'] * 100:.1f}%)"
    )
    line("")
    line(f"Legal basis: {legal_basis}")
    line("")
    line(DRAFT_MARKER)

    c.showPage()
    c.save()


def _write_xlsx(path, row):
    wb = Workbook()
    ws = wb.active
    ws.title = "samadhaan_prefill"
    ws.append(XLSX_COLUMNS)
    ws.append([row[col] for col in XLSX_COLUMNS])
    wb.save(path)


def prefill_demand_notice(
    invoice: dict,
    supplier: dict,
    interest_result: dict,
    output_dir: str = "out",
) -> dict:
    """Generate the draft PDF + XLSX. Returns PENDING_HUMAN_APPROVAL.

    Raises ValueError if supplier["flow"] != "full" or output_dir is missing.
    """
    if supplier.get("flow") != "full":
        raise ValueError(
            "prefill_demand_notice is only available for statutory_eligible "
            "suppliers (flow == 'full')."
        )
    if not os.path.isdir(output_dir):
        raise ValueError(f"output_dir does not exist: {output_dir!r}")

    invoice_id = invoice["invoice_id"]
    bank_rate_used = interest_result["bank_rate_used"]
    legal_basis = _legal_basis(bank_rate_used)

    pdf_path = os.path.join(output_dir, f"demand_{invoice_id}.pdf")
    xlsx_path = os.path.join(output_dir, f"samadhaan_{invoice_id}.xlsx")

    _write_pdf(pdf_path, invoice, supplier, interest_result, legal_basis)

    _write_xlsx(
        xlsx_path,
        {
            "supplier_name": supplier["name"],
            "udyam_number": supplier["udyam_number"],
            "buyer_name": invoice["buyer_name"],
            "invoice_id": invoice_id,
            "principal_inr": float(invoice["amount"]),
            "interest_inr": interest_result["interest"],
            "total_due_inr": interest_result["total_due"],
            "appointed_day": str(invoice["appointed_day"]),
            "statutory_rate_pct": interest_result["statutory_rate_pa"] * 100,
            "bank_rate_pct": bank_rate_used * 100,
            "legal_basis": legal_basis,
        },
    )

    return {
        "status": "PENDING_HUMAN_APPROVAL",
        "invoice_id": invoice_id,
        "pdf_path": pdf_path,
        "xlsx_path": xlsx_path,
    }
