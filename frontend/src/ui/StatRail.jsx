import { Eyebrow } from "@/ui/Text";
import { cn } from "@/lib/utils";

/**
 * An open strip of inline statistics separated by hairlines — no cards.
 * Used to carry secondary numbers so the page isn't a grid of boxes.
 */
export function StatRail({ children, className }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 divide-y divide-surface-line border-y border-surface-line sm:grid-cols-4 sm:divide-x sm:divide-y-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Stat({ label, children, hint, onClick, className }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "px-4 py-4 text-left transition-colors sm:px-5",
        onClick && "focus-ring hover:bg-surface-raised/60",
        className,
      )}
    >
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-2">{children}</div>
      {hint ? <p className="mt-1.5 text-xs text-ink-faint">{hint}</p> : null}
    </Comp>
  );
}
