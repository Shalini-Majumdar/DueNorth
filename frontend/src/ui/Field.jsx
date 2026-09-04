import { cn } from "@/lib/utils";

const control =
  "focus-ring w-full rounded-lg bg-surface-overlay px-3 text-sm text-ink-primary ring-1 ring-inset ring-surface-line transition-colors placeholder:text-ink-faint hover:ring-surface-edge focus:ring-jade-400/50 disabled:opacity-45";

export function Label({ className, ...props }) {
  return (
    <label
      className={cn("block text-2xs font-medium uppercase tracking-wider text-ink-muted", className)}
      {...props}
    />
  );
}

export function Input({ className, ...props }) {
  return <input className={cn(control, "h-9", className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cn(control, "h-9 appearance-none", className)} {...props}>
      {children}
    </select>
  );
}

export function Field({ label, hint, children, className }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? <Label>{label}</Label> : null}
      {children}
      {hint ? <p className="text-xs text-ink-faint">{hint}</p> : null}
    </div>
  );
}
