import { motion } from "motion/react";

import { spring } from "@/ui/motion";
import { cn } from "@/lib/utils";

/** In-page segmented filter. Controlled. */
export default function Tabs({ options, value, onChange, layoutId = "tab-marker", className }) {
  return (
    <div className={cn("inline-flex items-center gap-0.5 rounded-lg bg-surface-raised p-0.5 ring-1 ring-inset ring-surface-line", className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "focus-ring relative rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition-colors",
              active ? "text-ink-primary" : "text-ink-muted hover:text-ink-secondary",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={spring}
                className="absolute inset-0 rounded-[6px] bg-surface-overlay ring-1 ring-inset ring-surface-edge"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5 whitespace-nowrap">
              {opt.label}
              {opt.count != null ? (
                <span className={cn("font-mono text-2xs tnum", active ? "text-ink-muted" : "text-ink-faint")}>
                  {opt.count}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
