import { motion } from "motion/react";

import { DUR, EASE, STAGGER } from "@/ui/motion";
import { cn } from "@/lib/utils";

/* ── The typography scale. Every screen uses these, nothing rolls its own. ──
   Eyebrow        2xs / uppercase / tracked / ink-muted   — metric labels
   PageHeader     xl  / semibold / tight                  — one per route
   SectionHeader  sm  / medium                            — groups
   metric value   see <Money> / mono tabular
   body           sm  / ink-secondary
   meta           xs  / ink-muted
*/

export function Eyebrow({ children, className }) {
  return (
    <p className={cn("text-2xs font-medium uppercase tracking-wider text-ink-muted", className)}>{children}</p>
  );
}

export function PageHeader({ title, subtitle, actions, className }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.md, ease: EASE }}
      className={cn("mb-7 flex flex-wrap items-end justify-between gap-4", className)}
    >
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink-primary">{title}</h1>
        {subtitle ? <p className="mt-1.5 max-w-2xl text-sm text-ink-secondary">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </motion.header>
  );
}

export function SectionHeader({ title, hint, action, className }) {
  return (
    <div className={cn("mb-3.5 flex items-end justify-between gap-3", className)}>
      <div className="flex items-baseline gap-2.5">
        <h2 className="text-sm font-medium text-ink-primary">{title}</h2>
        {hint ? <span className="text-xs text-ink-faint">{hint}</span> : null}
      </div>
      {action}
    </div>
  );
}

export function Reveal({ children, className, delay = 0 }) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={{ animate: { transition: { staggerChildren: STAGGER, delayChildren: delay } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }) {
  return (
    <motion.div
      variants={{
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0, transition: { duration: DUR.md, ease: EASE } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
