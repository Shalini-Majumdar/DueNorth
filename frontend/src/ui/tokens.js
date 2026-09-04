// Semantic layer over the palette. Nothing in the app should reach for a raw
// colour — everything goes through a tone here so meaning stays consistent.
//   jade   = positive, recovered, primary action
//   steel  = neutral information
//   amber  = attention / needs a human
//   coral  = risk / exposure
export { cn } from "@/lib/utils";

export const MONEY_TONE = {
  default: "text-ink-primary",
  risk: "text-coral-300",
  recovered: "text-jade-300",
  info: "text-steel-300",
  warn: "text-amber-300",
  muted: "text-ink-muted",
};

export const TONE_TEXT = {
  jade: "text-jade-300",
  steel: "text-steel-300",
  amber: "text-amber-300",
  coral: "text-coral-300",
  neutral: "text-ink-muted",
};

export const TONE_DOT = {
  jade: "bg-jade-400",
  steel: "bg-steel-400",
  amber: "bg-amber-400",
  coral: "bg-coral-400",
  neutral: "bg-ink-faint",
};

export const TONE_RAIL = {
  jade: "bg-jade-400",
  steel: "bg-steel-400",
  amber: "bg-amber-400",
  coral: "bg-coral-400",
  neutral: "bg-surface-edge",
};

export const TONE_PILL = {
  jade: "bg-jade-400/12 text-jade-300 ring-1 ring-inset ring-jade-400/25",
  steel: "bg-steel-400/12 text-steel-300 ring-1 ring-inset ring-steel-400/25",
  amber: "bg-amber-400/12 text-amber-300 ring-1 ring-inset ring-amber-400/25",
  coral: "bg-coral-400/12 text-coral-300 ring-1 ring-inset ring-coral-400/25",
  neutral: "bg-surface-overlay text-ink-muted ring-1 ring-inset ring-surface-line",
};

// ── Invoice lifecycle ──────────────────────────────────────────────────────
export const STAGES = ["polite", "firm", "formal", "escalation", "recovered"];
export const STAGE_LABEL = {
  polite: "Polite",
  firm: "Firm",
  formal: "Formal notice",
  escalation: "MSEFC",
  recovered: "Recovered",
};

export function stageFor(days) {
  if (days > 45) return "escalation";
  if (days > 30) return "formal";
  if (days > 15) return "firm";
  return "polite";
}

export function nextAction(days) {
  if (days > 45) return "Prepare MSEFC notice";
  if (days > 30) return "Send formal notice";
  if (days > 15) return "Send firm reminder";
  return "Send polite reminder";
}

// ── Human review ───────────────────────────────────────────────────────────
export const REASON_META = {
  disputed: { label: "Disputed", tone: "coral", title: "Buyer has disputed this invoice" },
  Medium: { label: "Medium supplier", tone: "steel", title: "Outside MSMED Act Chapter V" },
  above_threshold: { label: "High value", tone: "amber", title: "Above the human-in-the-loop threshold" },
  msefc: { label: "MSEFC eligible", tone: "jade", title: "Eligible for statutory escalation" },
};

export const REVIEW_STATUS = {
  PENDING_HUMAN_APPROVAL: { label: "Awaiting decision", tone: "amber" },
  APPROVED: { label: "Approved", tone: "jade" },
  ESCALATED_TO_MSEFC: { label: "Escalated", tone: "coral" },
  ON_HOLD: { label: "On hold", tone: "steel" },
};

// ── Activity ───────────────────────────────────────────────────────────────
export const ACTION_META = {
  dry_run_message: { label: "Reminder sent", tone: "steel" },
  payment_link_created: { label: "Payment link generated", tone: "jade" },
  va_created: { label: "Virtual account opened", tone: "jade" },
  payment_captured: { label: "Payment captured", tone: "jade" },
  payment_failed: { label: "Payment failed", tone: "coral" },
  held: { label: "Held for review", tone: "amber" },
  escalated_human: { label: "Sent to human review", tone: "amber" },
  escalated_msefc: { label: "MSEFC notice prepared", tone: "coral" },
  link_renewed: { label: "Payment link renewed", tone: "steel" },
  skipped_paid: { label: "Skipped — already paid", tone: "neutral" },
};

export const ACTION_SHORT = {
  dry_run_message: "Reminders",
  payment_link_created: "Links",
  payment_captured: "Captured",
  payment_failed: "Failed",
  held: "Held",
  escalated_msefc: "MSEFC",
  link_renewed: "Renewed",
};

// ── Risk ───────────────────────────────────────────────────────────────────
export function riskTone(p) {
  if (p > 0.7) return "coral";
  if (p >= 0.4) return "amber";
  return "jade";
}
export function riskLabel(p) {
  if (p > 0.7) return "High";
  if (p >= 0.4) return "Watch";
  return "Low";
}

const SECTOR_LABEL = {
  auto_components: "Auto parts",
  textiles: "Textiles",
  electronics: "Electronics",
  construction: "Construction",
  pharma: "Pharma",
};
export const sectorLabel = (s) =>
  SECTOR_LABEL[s] || String(s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
