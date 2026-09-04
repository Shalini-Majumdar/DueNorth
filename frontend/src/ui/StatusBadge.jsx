import { TONE_DOT, TONE_PILL, cn, riskLabel, riskTone } from "@/ui/tokens";

/** One badge for every status in the product. */
export default function StatusBadge({ tone = "neutral", label, dot = true, className, title }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-2xs font-medium",
        TONE_PILL[tone] || TONE_PILL.neutral,
        className,
      )}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[tone])} /> : null}
      {label}
    </span>
  );
}

export function RiskBadge({ prob }) {
  return <StatusBadge tone={riskTone(prob)} label={riskLabel(prob)} />;
}

/**
 * Compact horizontal meter — used inline in dense tables so risk and priority
 * are scannable without flooding the page with colour.
 */
export function Meter({ value, tone = "steel", className, width = "w-14" }) {
  const pct = Math.max(2, Math.min(100, (Number(value) || 0) * 100));
  const fill = {
    jade: "bg-jade-400",
    steel: "bg-steel-400",
    amber: "bg-amber-400",
    coral: "bg-coral-400",
    neutral: "bg-ink-faint",
  }[tone];
  return (
    <span className={cn("inline-block h-1 overflow-hidden rounded-full bg-surface-line", width, className)}>
      <span className={cn("block h-full rounded-full", fill)} style={{ width: `${pct}%` }} />
    </span>
  );
}
