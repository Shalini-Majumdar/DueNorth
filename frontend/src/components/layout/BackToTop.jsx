import { AnimatePresence, motion } from "motion/react";
import { ArrowUp } from "lucide-react";

import { useScrollTop } from "@/hooks/useScrollTop";
import { DUR } from "@/ui/motion";

export default function BackToTop() {
  const { visible, scrollToTop } = useScrollTop(500);
  return (
    <AnimatePresence>
      {visible ? (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: DUR.sm }}
          onClick={scrollToTop}
          className="focus-ring fixed bottom-6 left-6 z-50 rounded-lg bg-surface-raised p-2 text-ink-muted shadow-lift ring-1 ring-inset ring-surface-line transition-colors hover:text-jade-300"
          aria-label="Back to top"
        >
          <ArrowUp size={16} />
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
