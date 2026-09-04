import { motion } from "motion/react";

import { DUR, EASE } from "@/ui/motion";
import { cn } from "@/lib/utils";

export default function EmptyState({ icon: Icon, title, subtitle, action, className }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.md, ease: EASE }}
      className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}
    >
      {Icon ? (
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-overlay text-ink-faint ring-1 ring-inset ring-surface-line">
          <Icon size={18} strokeWidth={1.75} />
        </div>
      ) : null}
      <p className="text-sm font-medium text-ink-secondary">{title}</p>
      {subtitle ? <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-ink-muted">{subtitle}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </motion.div>
  );
}
