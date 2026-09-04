import { motion } from "motion/react";

import RBSpotlightCard from "@/components/SpotlightCard";
import { DUR, EASE } from "@/ui/motion";
import { TONE_RAIL, cn } from "@/ui/tokens";

/**
 * Panel — the ONE bordered surface. Used only where the box represents a real
 * object (an invoice, a review case, a chart). Layout regions use `Region` and
 * `Divider` instead, so the product isn't a grid of identical rectangles.
 */
export function Panel({
  children,
  className,
  interactive = false,
  spotlight = false,
  rail,
  as = "div",
  ...props
}) {
  const base = cn(
    "relative rounded-xl bg-surface-raised ring-1 ring-inset ring-surface-line",
    rail && "overflow-hidden",
    className,
  );

  const railEl = rail ? (
    <span className={cn("absolute inset-y-0 left-0 w-[3px]", TONE_RAIL[rail] || TONE_RAIL.neutral)} />
  ) : null;

  if (spotlight) {
    return (
      <RBSpotlightCard className={base} spotlightColor="rgba(52, 211, 153, 0.09)">
        {railEl}
        {children}
      </RBSpotlightCard>
    );
  }

  if (interactive) {
    return (
      <motion.div
        whileHover={{ y: -1 }}
        transition={{ duration: DUR.sm, ease: EASE }}
        className={cn(base, "transition-shadow hover:ring-surface-edge hover:shadow-panel")}
        {...props}
      >
        {railEl}
        {children}
      </motion.div>
    );
  }

  const Comp = as;
  return (
    <Comp className={base} {...props}>
      {railEl}
      {children}
    </Comp>
  );
}

/** An open region — no border, no card. Groups content by space alone. */
export function Region({ children, className }) {
  return <section className={cn("relative", className)}>{children}</section>;
}

/** Hairline rule used to separate open regions. */
export function Divider({ className, label }) {
  if (label) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <span className="h-px flex-1 bg-surface-line" />
        <span className="text-2xs font-medium uppercase tracking-wider text-ink-faint">{label}</span>
        <span className="h-px flex-1 bg-surface-line" />
      </div>
    );
  }
  return <div className={cn("h-px w-full bg-surface-line", className)} />;
}

export default Panel;
