import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";

import { DUR, EASE } from "@/ui/motion";

const ToastContext = createContext(() => {});
export function useToast() {
  return useContext(ToastContext);
}

const STYLE = {
  success: { rail: "bg-jade-400", icon: "text-jade-300", Icon: CheckCircle2 },
  error: { rail: "bg-coral-400", icon: "text-coral-300", Icon: XCircle },
  warn: { rail: "bg-amber-400", icon: "text-amber-300", Icon: AlertTriangle },
  info: { rail: "bg-steel-400", icon: "text-steel-300", Icon: Info },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4400);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[120] flex w-[22rem] flex-col gap-2">
        <AnimatePresence>
          {toasts.map(({ id, message, type }) => {
            const s = STYLE[type] || STYLE.info;
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: DUR.md, ease: EASE }}
                className="pointer-events-auto relative flex items-start gap-2.5 overflow-hidden rounded-lg bg-surface-raised py-3 pl-4 pr-3.5 text-sm shadow-lift ring-1 ring-inset ring-surface-line"
              >
                <span className={`absolute inset-y-0 left-0 w-[3px] ${s.rail}`} />
                <s.Icon size={16} className={`mt-0.5 shrink-0 ${s.icon}`} />
                <span className="text-ink-secondary">{message}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
