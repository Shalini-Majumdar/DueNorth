import CountUp from "@/components/CountUp";
import { MONEY_TONE } from "@/ui/tokens";

const inr0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* Financial hierarchy — the figure always outweighs its label.
   NOTE: classes are joined plainly, not through `cn`. tailwind-merge treats an
   arbitrary `text-[clamp(...)]` and `text-<colour>` as the same utility group
   and silently drops one, which stripped the tone off every hero figure. */
const SIZE = {
  display: "text-display font-semibold",
  hero: "text-hero font-semibold",
  xl: "text-2xl leading-none tracking-[-0.015em] font-semibold",
  lg: "text-lg leading-tight font-semibold",
  md: "text-[15px] font-medium",
  sm: "text-[13px] font-medium",
};

const join = (...xs) => xs.filter(Boolean).join(" ");

export default function Money({
  amount,
  tone = "default",
  size = "lg",
  decimals = false,
  animate = false,
  prefix = "₹",
  className,
}) {
  const fmt = (v) => `${prefix}${(decimals ? inr2 : inr0).format(v || 0)}`;
  const cls = join("font-mono tnum", SIZE[size], MONEY_TONE[tone], className);
  if (animate) return <CountUp to={Number(amount) || 0} format={fmt} className={cls} />;
  return <span className={cls}>{fmt(Number(amount) || 0)}</span>;
}

/** Plain animated integer with the same type treatment, no currency. */
export function Figure({ value, size = "xl", tone = "default", className }) {
  return (
    <CountUp
      to={Number(value) || 0}
      format={(v) => new Intl.NumberFormat("en-IN").format(Math.round(v))}
      className={join("font-mono tnum", SIZE[size], MONEY_TONE[tone], className)}
    />
  );
}
