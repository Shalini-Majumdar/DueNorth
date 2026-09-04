import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { DUR, EASE, STAGGER } from "@/ui/motion";

/**
 * Reworked from React Bits AnimatedList into a DueNorth primitive:
 *  - real per-index stagger on first paint
 *  - `layout` animation so rows physically slide when the order changes
 *    (used to communicate re-ranking after an agent run)
 *  - highlight pulse for freshly-surfaced items
 *  - honours prefers-reduced-motion
 *  - no imposed chrome: the caller renders the full row via `renderItem`
 *
 * items: array of objects; getKey(item) must be stable across reorders.
 */
export default function AnimatedList({
  items = [],
  getKey = (_, i) => i,
  renderItem,
  onSelect,
  className = "",
  itemClassName = "",
  gap = "gap-1.5",
  highlightKeys,
}) {
  const reduce = useReducedMotion();
  const highlight = highlightKeys instanceof Set ? highlightKeys : new Set();

  return (
    <div className={`flex flex-col ${gap} ${className}`}>
      <AnimatePresence initial={false}>
        {items.map((item, i) => {
          const key = getKey(item, i);
          const isNew = highlight.has(key);
          return (
            <motion.div
              key={key}
              layout={!reduce}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: {
                  duration: DUR.md,
                  ease: EASE,
                  delay: reduce ? 0 : Math.min(i, 12) * STAGGER,
                },
              }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, transition: { duration: DUR.sm } }}
              transition={{ layout: { duration: DUR.md, ease: EASE } }}
              onClick={onSelect ? () => onSelect(item, i) : undefined}
              className={`${onSelect ? "cursor-pointer" : ""} ${
                isNew ? "animate-row-flash" : ""
              } ${itemClassName}`}
            >
              {renderItem(item, i)}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
