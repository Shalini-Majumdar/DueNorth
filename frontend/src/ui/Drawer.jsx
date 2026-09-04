import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useEffect } from "react";

import { DUR, EASE } from "@/ui/motion";
import { cn } from "@/lib/utils";

/** The investigation drawer. One style for the whole product. */
export default function Drawer({ open, onClose, title, subtitle, badge, children, footer, width = "max-w-[560px]" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[90]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DUR.sm }}
        >
          <div className="absolute inset-0 bg-canvas/75 backdrop-blur-[3px]" onClick={onClose} />
          <motion.aside
            initial={{ x: 32, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 32, opacity: 0 }}
            transition={{ duration: DUR.md, ease: EASE }}
            className={cn(
              "absolute right-0 top-0 flex h-full w-full flex-col bg-surface-base shadow-drawer ring-1 ring-inset ring-surface-line",
              width,
            )}
          >
            <header className="flex items-start justify-between gap-4 border-b border-surface-line px-6 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h2 className="truncate font-mono text-[15px] font-semibold text-ink-primary">{title}</h2>
                  {badge}
                </div>
                {subtitle ? <p className="mt-1 text-xs text-ink-muted">{subtitle}</p> : null}
              </div>
              <button
                onClick={onClose}
                className="focus-ring -mr-1.5 rounded-md p-1.5 text-ink-faint transition-colors hover:bg-surface-overlay hover:text-ink-primary"
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer ? <div className="border-t border-surface-line px-6 py-4">{footer}</div> : null}
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
