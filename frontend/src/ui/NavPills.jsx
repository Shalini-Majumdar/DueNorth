import { motion } from "motion/react";
import { NavLink, useLocation } from "react-router-dom";

import { spring } from "@/ui/motion";
import { cn } from "@/lib/utils";

/**
 * Primary navigation. A single underline+wash marker glides between routes via
 * a shared layout id — the pill-nav interaction, drawn in the DueNorth system
 * rather than React Bits' logo-and-hamburger marketing bar.
 */
export default function NavPills({ items, layoutId = "nav-marker", className }) {
  const { pathname } = useLocation();
  const isActive = (item) =>
    item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/");

  return (
    <nav className={cn("flex items-center gap-0.5", className)}>
      {items.map((item) => {
        const active = isActive(item);
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={cn(
              "focus-ring relative rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
              active ? "text-ink-primary" : "text-ink-muted hover:text-ink-secondary",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={spring}
                className="absolute inset-0 rounded-md bg-surface-overlay ring-1 ring-inset ring-surface-line"
              />
            )}
            <span className="relative z-10 whitespace-nowrap">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
