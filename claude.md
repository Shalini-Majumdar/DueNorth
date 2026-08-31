# DueNorth
## Rules (enforced on every response)
- NEVER hardcode RBI Bank Rate. Always read from config/rbi_rate.json.
- Statutory interest (Section 16) only for Micro/Small Udyam suppliers. 
  Medium/unregistered → reminders_only flow, no interest, no MSEFC.
- NEVER auto-file MSEFC. prefill_demand_notice() → PDF/XLSX → PENDING_HUMAN_APPROVAL only.
- HITL gates: disputed invoice, Medium supplier, amount > CONFIG["hitl_threshold"].
- No PII in logs. Log invoice_id and amount only. Secrets from env only.
## Layout
- engines/   — deterministic only, 100% unit tested, zero ML
- models/    — ML models, loaded once at startup via joblib
- app/       — Streamlit dashboard
- api/       — FastAPI webhook receiver
- data/      — synthetic_ledger.csv only, never paste into context
- config/    — rbi_rate.json, config.json
## Test command: pytest -q
## Lint command: ruff check .