export const API_BASE = import.meta.env.VITE_API_BASE || "";

export const URN_REGEX = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;

// Primary navigation — order matters, shown in the header pill nav.
export const NAV = [
  { to: "/dashboard", label: "Overview", end: true },
  { to: "/dashboard/chase", label: "Invoices" },
  { to: "/dashboard/lift", label: "Analytics" },
  { to: "/human-review", label: "Review" },
  { to: "/interest", label: "Calculator" },
  { to: "/audit", label: "Activity" },
];

export const AUDIT_ACTIONS = [
  "dry_run_message",
  "payment_link_created",
  "payment_captured",
  "payment_failed",
  "held",
  "escalated_msefc",
  "link_renewed",
];
