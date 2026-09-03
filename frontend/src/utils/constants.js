export const API_BASE = import.meta.env.VITE_API_BASE || "";

export const COLORS = {
  mint300: "#74CDAC",
  mint400: "#5cb993",
  mint500: "#44a57a",
  night800: "#292531",
  sage300: "#C1CCB7",
  sage400: "#a8b89c",
  blush200: "#E8BFBF",
  blush300: "#d4a0a0",
};

export const NAV_TABS = [
  { key: "dashboard", label: "Chase List", path: "/dashboard" },
  { key: "lift", label: "Recovery Lift", path: "/dashboard/lift" },
  { key: "interest", label: "Interest Calculator", path: "/interest" },
  { key: "review", label: "Human Review", path: "/human-review" },
  { key: "audit", label: "Audit Trail", path: "/audit" },
  { key: "faq", label: "FAQ", path: "/faq" },
];

export const AUDIT_ACTIONS = [
  "payment_link_created",
  "payment_captured",
  "escalated_msefc",
  "held",
  "dry_run_message",
];

export const URN_REGEX = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;
