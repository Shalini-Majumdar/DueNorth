export default function RiskBadge({ probability }) {
  const p = Number(probability) || 0;
  let cls = "bg-mint-100 text-mint-500";
  let label = "LOW";
  if (p > 0.7) {
    cls = "bg-blush-200 text-blush-400";
    label = "HIGH";
  } else if (p >= 0.4) {
    cls = "bg-sage-200 text-sage-400";
    label = "MEDIUM";
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase ${cls}`}
    >
      {label}
    </span>
  );
}
