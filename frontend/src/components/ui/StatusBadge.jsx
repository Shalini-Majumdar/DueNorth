const STYLES = {
  Medium: "bg-sage-300 text-night-800",
  disputed: "bg-blush-300 text-night-800",
  above_threshold: "bg-night-800 text-white",
  msefc: "bg-mint-300 text-night-800",
  PENDING_HUMAN_APPROVAL: "bg-sage-200 text-sage-400",
  APPROVED: "bg-mint-100 text-mint-500",
  ESCALATED_TO_MSEFC: "bg-blush-200 text-blush-400",
  ON_HOLD: "bg-sage-200 text-sage-400",
};

export default function StatusBadge({ value }) {
  const cls = STYLES[value] || "bg-sage-100 text-sage-400";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {String(value).replace(/_/g, " ")}
    </span>
  );
}
