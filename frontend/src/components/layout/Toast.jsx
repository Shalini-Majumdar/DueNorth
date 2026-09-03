import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle, Info } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const STYLE = {
  success: { cls: "bg-mint-300 text-night-800", Icon: CheckCircle },
  error: { cls: "bg-blush-300 text-night-800", Icon: AlertCircle },
  info: { cls: "bg-sage-300 text-night-800", Icon: Info },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-80 flex-col gap-2">
        <AnimatePresence>
          {toasts.map(({ id, message, type }) => {
            const { cls, Icon } = STYLE[type] || STYLE.info;
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 60 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className={`pointer-events-auto flex items-start gap-2 rounded-lg px-4 py-3 text-sm shadow-sm ${cls}`}
              >
                <Icon size={18} className="mt-0.5 shrink-0" />
                <span>{message}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
