"""DueNorth demo dashboard (Streamlit).

Loads the trained models once at startup, never retrains, never calls the
Razorpay API. Shows: AI-ranked chase list, recovery-lift chart, and a live
Section 16 interest calculator.

Run:  streamlit run app/dashboard.py
"""

from __future__ import annotations

import json
import os
import sys
from datetime import UTC, datetime, timedelta

import pandas as pd
import streamlit as st

# Allow `streamlit run app/dashboard.py` from the repo root.
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from engines.interest import section16_interest
from evaluation.lift import compute_lift, overdue_invoices
from models import late_payment, ptp_reliability

LEDGER_PATH = "data/synthetic_ledger.csv"
RATE_CONFIG_PATH = "config/rbi_rate.json"


@st.cache_resource
def load_models():
    clf = late_payment.load_model()
    reg = ptp_reliability.load_model()
    return clf, reg


@st.cache_data
def load_rate_config(path: str = RATE_CONFIG_PATH) -> dict:
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


@st.cache_data
def load_chase_list(_clf_id: str) -> pd.DataFrame:
    clf, _ = load_models()
    ledger = pd.read_csv(LEDGER_PATH)
    overdue = overdue_invoices(ledger).copy()

    overdue["pred_late_prob"] = [
        late_payment.score_invoice(row, model=clf)
        for row in overdue.to_dict("records")
    ]
    overdue["priority_score"] = overdue["pred_late_prob"] * overdue["amount"]
    overdue = overdue.sort_values("priority_score", ascending=False)

    overdue["invoice_id_masked"] = "…" + overdue["invoice_id"].str[-4:]
    view = overdue[
        [
            "invoice_id_masked",
            "sector",
            "amount",
            "days_past_due",
            "pred_late_prob",
            "priority_score",
        ]
    ].reset_index(drop=True)
    return view


@st.cache_data
def load_lift() -> dict:
    return compute_lift()


def render_sidebar() -> dict:
    cfg = load_rate_config()
    rate = cfg["bank_rate"]
    st.sidebar.metric("RBI Bank Rate", f"{rate * 100:.2f}%")
    st.sidebar.metric("Statutory Rate (3×)", f"{rate * 300:.2f}%")
    st.sidebar.caption(
        f"As of {cfg['as_of']} — Source: RBI MPC 62nd meeting"
    )
    st.sidebar.caption(
        "Rate read from config/rbi_rate.json — updates automatically"
    )
    return cfg


def render_chase_tab() -> None:
    st.header("Overdue Invoices — AI Ranked")
    view = load_chase_list("v1")
    styled = view.copy()
    styled["amount"] = styled["amount"].map(lambda v: f"Rs {v:,.0f}")
    styled["pred_late_prob"] = styled["pred_late_prob"].map(lambda v: f"{v * 100:.0f}%")
    styled["priority_score"] = styled["priority_score"].map(lambda v: f"{v:,.0f}")
    st.dataframe(styled, use_container_width=True, hide_index=True)
    st.caption(
        f"{len(view)} overdue invoices. Customer identifiers are masked — no PII shown."
    )


def render_lift_tab() -> None:
    st.header("AI Chase Order vs Oldest-First Baseline")
    results = load_lift()

    c30, c60, c90 = st.columns(3)
    c30.metric(
        "Day 30 Lift",
        f"+Rs {results['lift_day_30']:,.0f} ({results['lift_pct_30']:.1f}%)",
    )
    c60.metric(
        "Day 60 Lift",
        f"+Rs {results['lift_day_60']:,.0f} ({results['lift_pct_60']:.1f}%)",
    )
    c90.metric(
        "Day 90 Lift",
        f"+Rs {results['lift_day_90']:,.0f} ({results['lift_pct_90']:.1f}%)",
    )

    curve_df = pd.DataFrame(
        {
            "AI Ranked Order": results["ai_curve"],
            "Oldest-First Baseline": results["base_curve"],
        }
    )
    curve_df.index.name = "Day"
    st.line_chart(curve_df)
    st.caption("Measured on synthetic ledger. Real-world lift will vary.")


def render_interest_tab(cfg: dict) -> None:
    st.header("Section 16 Interest — Live Demo")
    col1, col2 = st.columns(2)
    principal = col1.number_input("Principal (Rs)", min_value=0.0, value=500_000.0, step=10_000.0)
    days_overdue = col2.number_input("Days Overdue", min_value=0, value=90, step=1)
    default_due = datetime.now(UTC).date() - timedelta(days=90)
    due_date = st.date_input("Invoice Due Date", value=default_due)

    if st.button("Calculate"):
        start = due_date
        end = due_date + timedelta(days=int(days_overdue))
        result = section16_interest(float(principal), start, end)

        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Principal", f"Rs {result['principal']:,.2f}")
        m2.metric("Interest Accrued", f"Rs {result['interest']:,.2f}")
        m3.metric("Total Due", f"Rs {result['total_due']:,.2f}")
        m4.metric("Statutory Rate", f"{result['statutory_rate_pa'] * 100:.2f}%")

        schedule = pd.DataFrame(result["schedule"])
        if not schedule.empty:
            st.subheader("Monthly rest schedule")
            st.dataframe(schedule, use_container_width=True, hide_index=True)

    st.caption(
        "Statutory rate = 3 × RBI Bank Rate. Applies only to Micro/Small "
        "Udyam-registered suppliers."
    )


def main() -> None:
    st.set_page_config(page_title="DueNorth", layout="wide")
    st.title("DueNorth — MSME Receivables Copilot")
    cfg = render_sidebar()

    tab1, tab2, tab3 = st.tabs(
        ["Chase List", "Recovery Lift", "Interest Calculator Demo"]
    )
    with tab1:
        render_chase_tab()
    with tab2:
        render_lift_tab()
    with tab3:
        render_interest_tab(cfg)


if __name__ == "__main__":
    main()
