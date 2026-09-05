# DueNorth

**Autonomous receivables recovery for Indian MSMEs.** DueNorth ranks a supplier's
overdue invoices by predicted late-payment risk, computes the statutory interest
they are legally owed under the MSMED Act 2006, routes each invoice to the
correct Razorpay collection rail, drafts and sends the dunning message — and
stops dead at every point where a human must decide.

---

## The problem

₹10.7 lakh crore is locked up in delayed payments to Indian MSMEs. The
consequences of that are not evenly distributed:

- **The law already protects suppliers, and almost nobody uses it.** Sections
  15–16 of the MSMED Act 2006 entitle a Micro or Small supplier to *compound
  interest at three times the RBI Bank Rate*, with monthly rests, on any payment
  delayed beyond the appointed day. It is court-enforceable and the buyer cannot
  contract out of it. Most suppliers never claim a rupee of it, because
  computing it correctly is fiddly and asking for it feels confrontational.
- **Chasing is done oldest-first.** A two-person accounts team works the invoice
  that has been outstanding longest — not the one most likely to go bad, and not
  the one with the most money at stake.
- **Collection fails at the rail.** NPCI caps UPI at ₹1,00,000 per transaction.
  A ₹4 lakh B2B invoice sent as a UPI payment link simply fails at the bank. The
  supplier reads it as "the buyer is ignoring me."
- **The escalation path is unused.** The MSEFC / Samadhaan route exists and
  targets 90-day resolution, but preparing a filing means assembling the
  interest computation, the invoice trail and the notice by hand.

## The solution

DueNorth is an agent that works the receivables book the way a good collections
analyst would — but computes the statutory interest exactly, never picks the
wrong payment rail, and never takes a legal action on its own.

Its central design commitment: **the parts that must be correct are deterministic
code, and the parts that use AI cannot override them.**

---

## Architecture — three layers that never mix

This separation is the design argument, not an implementation detail. A model
being wrong should degrade *prioritisation*. It must never change what a
supplier is legally owed, which rail an invoice is collected on, or whether a
demand notice goes out.

### Layer 1 — Deterministic engines (`engines/`)

Pure Python. No ML, no network, no judgment calls. 100% unit-tested.

| Engine | File | What it does |
|---|---|---|
| **Udyam gate** | `engines/udyam.py` | Validates the URN (`UDYAM-XX-00-0000000`) and assigns a flow. Micro/Small with a valid URN → `full` (statutory interest + MSEFC). Medium or unregistered → `reminders_only`. A Micro/Small supplier with a malformed URN raises — the system refuses to guess. |
| **Section 16 interest** | `engines/interest.py` | `appointed_day()` — day 16 with no written agreement, else agreed days + 1, capped at 45. `section16_interest()` — compounds at `3 × bank_rate / 12` per monthly rest, pro-rating the final stub month, and returns the full rest-by-rest schedule. `appropriate_payment()` — applies partial payments to interest first, then principal (*DSL Enterprises v MSEDCL*). **The Bank Rate is read from `config/rbi_rate.json` — no rate literal exists anywhere in `engines/`.** |
| **Payment-rail router** | `engines/rail_router.py` | `≤ ₹1,00,000` → Razorpay Payment Link. `> ₹1,00,000` → Smart Collect virtual account (NEFT/RTGS/IMPS). This encodes the NPCI per-transaction UPI ceiling, which cannot be negotiated. `route_payment()` is dry-run; `live_route_payment()` calls the real API and **never raises** — on failure it returns `{"rail": "failed", "retry": True}`. |
| **Dunning state machine** | `engines/dunning.py` | `choose_step()` maps (days past due, status, statutory eligibility, model score) → `none / polite / firm / formal / HOLD`. `stop_or_escalate()` → `STOP / ESCALATE_HUMAN / ESCALATE_MSEFC_PREFILL / CONTINUE`. `needs_human()` enforces the three HITL gates. Transitions are fixed: a disputed invoice *always* holds; a paid invoice *always* stops. |
| **MSEFC pre-fill** | `engines/escalation.py` | Generates a PDF demand notice (reportlab) and a Samadhaan XLSX (openpyxl). Always returns `PENDING_HUMAN_APPROVAL`. The PDF carries the literal line `*** DRAFT — REQUIRES HUMAN REVIEW — NOT FILED ***`. Refuses to run for a `reminders_only` supplier. |

### Layer 2 — ML models (`models/`)

XGBoost, trained once on the synthetic ledger, serialised with joblib, loaded
once at startup. They **never retrain in the running app**.

| Model | File | Detail |
|---|---|---|
| **Late-payment classifier** | `models/late_payment.py` | Binary XGBoost → `P(late)`. Features: `amount`, `typical_order_size`, `size_ratio`, `customer_on_time_rate`, `customer_ptp_kept_rate`, `customer_ptp_history`, plus one-hot sector. **Leakage guard:** `days_past_due`, `actual_paid_date`, `status`, `partial_paid_amount`, `is_late` are asserted absent from the feature matrix, and a test proves the top feature is a legitimate signal. Held-out AUROC ≈ 0.59. |
| **PtP-reliability regressor** | `models/ptp_reliability.py` | XGBoost regressor → probability a promise-to-pay is kept. R² ≈ 0.88, MAE 0.048 against a target std of 0.167 (the `mae_vs_std` gate returns `PASS`). |

The classifier's score does two things: it **ranks** the chase list
(`priority = P(late) × amount`) and it feeds `choose_step()` as one of four
inputs. It cannot, on its own, cause any action.

### Layer 3 — LLM (language only)

`llm_personalise()` in `engines/dunning.py`. Takes a rendered template plus
context and asks Gemini (`gemini-1.5-flash`), then Groq (`llama3-8b-8192`), to
rewrite it professionally. It decides **nothing** — not whether to send, not
when, not which link to attach.

**It never raises and it never blocks.** With no API keys — the default — every
call falls through to the fixed template and the system runs identically. This
is deliberate: *correctness does not depend on the LLM being available.* Two
tests assert the fallback holds with no keys and with deliberately invalid keys.

---

## Where Razorpay comes in

Razorpay is the collection rail and the settlement signal. It appears at exactly
two points.

**1. Creating the instrument (outbound).** When the agent decides to chase an
invoice, `live_route_payment()` calls Razorpay test mode:

- `≤ ₹1 lakh` → `client.payment_link.create({...})` with `reference_id` set to the
  invoice id (which doubles as the idempotency key). Returns a real `short_url`
  that goes into the dunning message.
- `> ₹1 lakh` → `client.virtual_account.create({...})` with
  `receivers: {types: ["bank_account"]}` and `amount_expected`. Returns a real
  virtual account the buyer pays into by NEFT/RTGS.

Verified live against test keys — a real link was created:
`plink_TXE5dHm4Vfxg3O` → `https://rzp.io/rzp/zqUQl6V8`.

**2. Hearing about payment (inbound).** `POST /webhook` in `api/webhook.py`:

1. Read the **raw body** (before JSON parsing — required for a correct HMAC).
2. Verify `x-razorpay-signature` as HMAC-SHA256 of the raw body under
   `RAZORPAY_WEBHOOK_SECRET`, compared with `hmac.compare_digest`. A tampered or
   unsigned request gets `400` and is never processed.
3. Take `x-razorpay-event-id` as the idempotency key (falling back to
   `sha256(body)`), and check it against the `webhook_events` table.
4. Insert it — the `PRIMARY KEY` on `event_id` is the hard idempotency guard.
5. Return `200` immediately; process in a FastAPI background task so Razorpay is
   never left waiting.

Handlers: `payment.captured` and `payment_link.paid` mark the invoice paid, log
it, and fire the WhatsApp notification; `payment_link.expired` re-issues a link
*unless the invoice is already paid*; `payment.failed` logs without retrying
(retry is the agent loop's job, not the webhook's).

---

## The agentic workflow, end to end

`run_agent_loop()` in `api/agent_loop.py`. One pass over the book:

| # | Step | Where |
|---|---|---|
| 1 | **Ingest.** CSV/Excel from Tally, Zoho, Busy. Headers mapped case-insensitively to the DueNorth schema. Bad rows are **quarantined with a reason**, never silently dropped. | `data/ingest.py` |
| 2 | **Select the book.** `days_past_due > 0 AND status != "paid"`. | `evaluation/lift.py::overdue_invoices` |
| 3 | **Persist.** Upsert each invoice into SQLite. | `api/db.py` |
| 4 | **HITL gate.** `needs_human()` — Medium supplier / disputed / above the ₹10 lakh threshold → `human_review`, log `HOLD`, **stop working this invoice**. | `engines/dunning.py` |
| 5 | **Stop-or-escalate.** Paid → stop. Disputed → human. 45+ days & statutorily covered → MSEFC branch. | `engines/dunning.py` |
| 6 | **MSEFC branch.** Compute Section 16 interest, generate the PDF + XLSX, file a `human_review` row as `PENDING_HUMAN_APPROVAL`. **Nothing is submitted.** | `engines/escalation.py` |
| 7 | **Score & choose.** `choose_step_with_model()` runs the classifier and hands `P(late)` to the state machine → polite / firm / formal. | `engines/dunning.py` |
| 8 | **Personalise.** `llm_personalise()` — Gemini → Groq → template. | `engines/dunning.py` |
| 9 | **Act.** Dry run: log the drafted message. Live: `live_route_payment()` creates the real Razorpay instrument, store the link/VA on the invoice. | `engines/rail_router.py` |
| 10 | **Audit.** Every branch writes one `dunning_log` row: invoice, step, action, message, Razorpay id, timestamp. | `api/db.py` |
| 11 | **Evaluate.** `compute_lift()` simulates ₹ recovered under AI-ranked order vs oldest-first at days 30/60/90. | `evaluation/lift.py` |

**Idempotency.** The returned summary is a pure classification of the book, so it
is identical across runs; every database write is guarded so a second run adds no
duplicate rows. A test asserts this.

**Auditability.** Every automated action is reconstructable from `dunning_log`
alone: what was decided, on which invoice, at what time, with which payment
reference.

---

## Human-in-the-loop — the part to lead with

DueNorth is autonomous right up to the point where being wrong would be
expensive, and then it stops.

- **Disputed invoice** → hold. Statutory pressure on a disputed invoice is legally
  and commercially wrong.
- **Above ₹10,00,000** (`config/config.json`, configurable) → hold. Too much
  single-buyer exposure for an unattended action.
- **Medium or unregistered supplier** → reminders only, and *no interest is
  computed at all*, because Chapter V of the MSMED Act does not cover them.
- **MSEFC filing** → never automatic. `prefill_demand_notice()` produces a draft
  that returns `PENDING_HUMAN_APPROVAL` and stamps the PDF as not filed.

The Review screen states three things for every case: **why automation stopped**,
**what is at stake**, and **what DueNorth advises** — with an explicit confirm
step on the decision.

---

## Feature map

**Backend**
- Deterministic statutory-interest engine with a rest-by-rest schedule
- NPCI-aware payment-rail routing (dry-run + live Razorpay)
- Rule-based dunning state machine with three HITL gates
- Section 16 PDF demand notice + Samadhaan XLSX pre-fill
- Two XGBoost models with an explicit leakage guard
- LLM personalisation with a guaranteed template fallback
- HMAC-verified, idempotent Razorpay webhook receiver
- SQLite persistence: `invoices`, `dunning_log`, `webhook_events`, `human_review`
- CSV/Excel ingestion with reasoned quarantine
- AI-vs-baseline recovery-lift simulation
- WhatsApp payment notification (silent-skip when unconfigured), Sentry (no-op on empty DSN)
- REST API for the frontend, CI on GitHub Actions, Render deploy config

**Frontend** (React + Vite, dark navy/jade design system)
- **Command centre** — money at risk (coral) vs projected recovery (jade) as the hero, exposure split by risk tier, open stat rail, live priority queue, autonomous activity stream
- **Invoices** — dense ranked blotter with risk rails, inline risk meters, next-action column, filters, and an investigation drawer per invoice
- **Investigation drawer** — outstanding, risk, recovery stage track, full Section 16 breakdown, per-invoice timeline, MSEFC draft action
- **Analytics** — AI-ranked vs oldest-first headline comparison, day 30/60/90 advantage, cumulative recovery chart, exposure by risk tier and by sector
- **Human review** — decision workbench with why/stake/advice and confirm-to-act
- **Calculator** — precise inputs + slider exploration, live recalculation, full auditable calculation trail
- **Activity** — grouped operational timeline, expandable events, category filters
- **Settings / FAQ** — runtime config surfaced read-only; statutory explanations

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Engines | Python 3.11, stdlib + `python-dateutil` | Zero-dependency correctness |
| ML | XGBoost, scikit-learn, pandas, joblib | Tabular data; fast, explainable, tiny artefacts |
| Documents | reportlab (PDF), openpyxl (XLSX) | Legal-grade output |
| API | FastAPI, uvicorn | Async, native background tasks, HMAC-friendly raw body |
| Persistence | SQLite (`sqlite3`) | Single-file, zero-ops, real ACID |
| Payments | Razorpay (test mode) | Payment Links + Smart Collect virtual accounts |
| LLM | Gemini 1.5 Flash → Groq Llama 3 → template | Free tiers, and it degrades to a template |
| Frontend | React 18, Vite 6, Tailwind 3, Motion 12, Recharts, React Bits | — |
| Quality | pytest (157 tests), ruff, GitHub Actions | Every engine rule is a test |
| Ops | Render (`render.yaml`), Sentry (optional) | Two services: dashboard + webhook |

**React Bits** is used as an interaction toolkit, not a showcase: `CountUp`
(financial figures), `AnimatedList` (re-ranking + activity), `SpotlightCard`
(two surfaces), `Stepper` (registration), `ElasticSlider` (what-if),
`GradualBlur` (scroll masks), `Noise` (static surface texture), `BlurText`
(login headline). Each was re-tokenised to the DueNorth system.

---

## Running it

```bash
# 1. Backend
py -3.11 -m venv .venv
.venv\Scripts\activate            # Windows;  source .venv/bin/activate on POSIX
pip install -r requirements.txt

cp .env.example .env               # add Razorpay test keys; LLM keys optional

python data/generate_ledger.py     # 5,000 synthetic invoices
python models/late_payment.py      # train + save classifier
python models/ptp_reliability.py   # train + save regressor

uvicorn api.webhook:app --port 8000

# 2. Frontend (second terminal)
cd frontend
npm install
npm run dev                        # http://localhost:5173
```

Quality gates:

```bash
pytest -q          # 157 passed
ruff check .       # All checks passed
cd frontend && npm run build
```

Optional smoke check of every engine in one go:

```bash
python scripts/manual/feature_tests.py
```

---

## Demo script

**Login →** the statutory strip at the bottom sets the frame before you have
said a word. Register to show the Udyam gate — and note that the verdict comes
from the **server**, not the browser: continuing from step 2 calls
`POST /api/onboard`, which runs `engines/udyam.onboard()` and persists the
result. Type a malformed URN for a `Small` supplier and the step **refuses to
advance**, showing the engine's own rejection text. Fix it and you get *Full
statutory cover*. Switch to `Medium`, and the verdict becomes *Reminders only* —
no statutory interest, no MSEFC. That stored verdict is what the agent loop then
runs under. The law, enforced at signup, by the same tested code path.

**Command centre →** lead with the two hero numbers. **₹5.99 Cr at risk**
(coral) against **₹2.22 Cr projected recovery** (jade). Point at the exposure
bar: only 2% of the money sits in high-risk invoices, 40% is on watch.

**Run agent →** the moment to make them watch. Rows physically reorder, changed
positions flash, the activity stream grows, the figures count to their new
values. Then say what actually happened: *669 processed → 285 reminders drafted,
305 held for a human, 79 MSEFC notices prepared, 0 skipped.*

**Invoices →** dense, scannable, ranked by `P(late) × amount`. Open any row.

**The drawer** is the strongest single screen: outstanding, risk, the recovery
stage track, and the **rest-by-rest Section 16 computation** with the appointed
day and the exact rupees-and-paise interest. This is the number the supplier can
put on a demand notice.

**Audit trail →** expand any drafted reminder. Alongside the step and the
Razorpay reference sits **PtP reliability** and the **next follow-up date** —
0.82 buys the buyer a week, 0.31 gets them chased again tomorrow. Two models are
visibly doing two different jobs: one ranks *who*, the other decides *when*.

**Review →** *"This is why it's trustworthy."* Every case says why automation
stopped, what is at stake, and what DueNorth advises. Every action needs a
confirm. Nothing has been filed.

**Analytics →** AI-ranked ₹2.22 Cr vs oldest-first ₹1.44 Cr at day 90.
**+165% by day 30.** The advantage is largest early, which is exactly when cash
matters to an MSME.

**Calculator →** drag the slider; watch interest recompute live. Then scroll to
the **calculation trail** — every monthly rest, opening balance, interest added.
Auditable, not a black box.

**Activity →** every action with its invoice and Razorpay reference.

**Close on the architecture:** *"The AI ranks. It never decides what you're owed,
which rail collects it, or whether a legal notice goes out. Those are
deterministic engines with 157 tests behind them. Pull the LLM's API keys and
the system keeps running on templates."*

### Proving the guarantees live

```bash
# Tamper-proof webhook — returns 400, never processed
python scripts/manual/tamper_check.py

# Idempotency — same event twice, processed once
pytest tests/test_demos.py -q -s
```

That last command prints all three guarantees: duplicate webhook → `already_processed`
with exactly one row in `webhook_events`; a disputed invoice → held with no
payment link created; the LLM with no keys → clean template fallback.

---

## Honest scope

For judges, and so the roadmap is credible:

- The ledger is **synthetic** (5,000 invoices, `data/generate_ledger.py`) — real
  supplier data was not available. Every calculation on top of it is real.
- Held-out **AUROC is ≈ 0.59**. The synthetic label is a deliberately noisy
  Bernoulli draw, which caps achievable separation. The lift result does not
  depend on a strong classifier — ranking by `P(late) × amount` beats
  oldest-first because *amount* carries most of the signal. Real payment history
  should improve this materially.
- The **PtP model schedules follow-ups** (reliability ≥ 0.70 → 7 days, ≥ 0.40 →
  3 days, below → 1 day), recorded on every `dunning_log` row. It does not yet
  *send* on that schedule — there is no background scheduler, so the cadence is
  planned and auditable rather than executed.
- The **Udyam gate runs per onboarding** via `POST /api/onboard`, persisted to the
  `suppliers` table and read by the agent loop. It is still **one supplier per
  deployment** (`supplier_id="default"`) — the plumbing is per-tenant, the
  addressing is not.
- **Auth is a front-end mock** (email in `localStorage`). No credential store.
- **Razorpay runs in test mode.** Live keys create real test-mode links.
- Ingestion maps a **fixed dictionary of known headers** case-insensitively and
  de-duplicates by invoice id (first occurrence wins, repeats are quarantined).
  It does **not** do fuzzy header matching — an unrecognised header is reported
  as unmapped, not guessed at.
- Dunning templates are **English only**.

## Future scope

- Multi-tenant addressing: `supplier_id` on every invoice, so one deployment
  serves many suppliers (the `suppliers` table and lookup already exist)
- A background scheduler that actually fires on the PtP follow-up dates, rather
  than recording them for the next manual run
- Fuzzy / learned header matching on ingest, for exports we have never seen
- Real authentication (credential store, sessions, per-tenant authorisation)
- Multilingual dunning (Hindi, Marathi, Gujarati, Tamil) — the LLM layer already
  takes a language hint
- Real accounting integrations (Tally XML, Zoho Books API) in place of CSV
- Retraining pipeline on real repayment outcomes with drift monitoring
- One-click Samadhaan submission once a human has signed the draft
- Email alongside WhatsApp; buyer-side payment portal

---

## Demo video

<!-- Replace the link below once the walkthrough is uploaded. -->

**▶ Watch the walkthrough:** _link to be added_

| | |
|---|---|
| Duration | — |
| Covers | Udyam gate → command centre → Run agent → invoice drawer → human review → analytics → calculator |

---

## Repository layout

```
engines/      Deterministic rules. No ML, no network. 100% tested.
models/       XGBoost training + scoring. Loaded once, never retrained live.
evaluation/   AI-ranked vs oldest-first recovery simulation.
data/         Synthetic ledger generator + CSV/Excel ingestion.
api/          FastAPI app: webhook receiver, REST routes, agent loop, SQLite.
app/          Legacy Streamlit dashboard (kept as a fallback).
frontend/     React + Vite command centre — the primary UI.
config/       rbi_rate.json (the single source of the Bank Rate), config.json.
tests/        157 tests, including three explicit failure demos.
scripts/      Manual verification scripts (not collected by pytest).
```

**One rule worth repeating:** the RBI Bank Rate lives in `config/rbi_rate.json`
and nowhere else. When the MPC moves it, one line changes and every interest
calculation in the system follows.
