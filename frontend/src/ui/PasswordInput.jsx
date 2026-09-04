import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export default function PasswordInput({ value, onChange, placeholder = "••••••••", className, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "focus-ring h-9 w-full rounded-lg bg-surface-overlay px-3 pr-9 text-sm text-ink-primary ring-1 ring-inset ring-surface-line transition-colors placeholder:text-ink-faint hover:ring-surface-edge focus:ring-jade-400/50",
          className,
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-ink-faint transition-colors hover:text-ink-secondary"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}
