import { motion } from "motion/react";
import { Check } from "lucide-react";

import { DUR, EASE } from "@/ui/motion";
import { STAGES, STAGE_LABEL, cn } from "@/ui/tokens";

/**
 * Read-only recovery lifecycle: polite → firm → formal → MSEFC → recovered.
 * Deliberately drawn like the registration Stepper so both read as one system.
 */
export default function StageTrack({ current = "polite", recovered = false, className }) {
  const idx = recovered ? STAGES.length - 1 : Math.max(0, STAGES.indexOf(current));

  return (
    <div className={cn("flex items-start", className)}>
      {STAGES.map((stage, i) => {
        const done = i < idx || (recovered && i === STAGES.length - 1);
        const active = i === idx && !done;
        return (
          <div key={stage} className="flex flex-1 flex-col items-center last:flex-none">
            <div className="flex w-full items-center">
              {i > 0 && (
                <div className="h-px flex-1 bg-surface-line">
                  <motion.div
                    className="h-px bg-jade-400"
                    initial={false}
                    animate={{ width: i <= idx ? "100%" : "0%" }}
                    transition={{ duration: DUR.md, ease: EASE }}
                  />
                </div>
              )}
              <motion.div
                initial={false}
                animate={{
                  backgroundColor: done ? "#34D399" : active ? "rgba(52,211,153,0.14)" : "#213141",
                  borderColor: done || active ? "#34D399" : "#2C3F53",
                }}
                transition={{ duration: DUR.sm }}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
              >
                {done ? (
                  <Check size={11} className="text-jade-900" strokeWidth={3} />
                ) : (
                  <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-jade-400" : "bg-ink-faint")} />
                )}
              </motion.div>
              {i < STAGES.length - 1 && (
                <div className="h-px flex-1 bg-surface-line">
                  <motion.div
                    className="h-px bg-jade-400"
                    initial={false}
                    animate={{ width: i < idx ? "100%" : "0%" }}
                    transition={{ duration: DUR.md, ease: EASE }}
                  />
                </div>
              )}
            </div>
            <span
              className={cn(
                "mt-2 text-center text-2xs leading-tight",
                done ? "text-jade-300" : active ? "text-ink-primary" : "text-ink-faint",
              )}
            >
              {STAGE_LABEL[stage]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
