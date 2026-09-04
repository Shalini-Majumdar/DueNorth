import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, HelpCircle, LogOut, Menu, Settings, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { api } from "@/api/client";
import { useApi } from "@/hooks/useApi";
import { DUR, EASE, NavPills } from "@/ui";
import { NAV } from "@/utils/constants";

function Mark() {
  return (
    <NavLink to="/dashboard" className="focus-ring flex items-center gap-2.5 rounded-md pr-2">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 1.5 18 6v8l-8 4.5L2 14V6l8-4.5Z" stroke="#34D399" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M10 18.5V10l8-4" stroke="#34D399" strokeWidth="1.4" strokeLinejoin="round" opacity=".55" />
        <path d="M10 10 2 6" stroke="#34D399" strokeWidth="1.4" strokeLinejoin="round" opacity=".3" />
      </svg>
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink-primary">DueNorth</span>
    </NavLink>
  );
}

/** Statutory rates stay visible but sit clearly below the nav in hierarchy. */
function RateStrip() {
  const { data } = useApi(() => api.getConfig(), []);
  const bank = ((data?.bank_rate ?? 0.055) * 100).toFixed(2);
  const stat = ((data?.statutory_rate ?? 0.165) * 100).toFixed(2);
  return (
    <div
      title={`RBI Bank Rate as of ${data?.as_of || "2026-08-05"} · ${data?.source || ""}`}
      className="hidden items-center gap-2 text-2xs md:flex"
    >
      <span className="text-ink-faint">Bank</span>
      <span className="font-mono tnum text-ink-muted">{bank}%</span>
      <span className="h-2.5 w-px bg-surface-line" />
      <span className="text-ink-faint">Statutory</span>
      <span className="font-mono tnum text-jade-300">{stat}%</span>
    </div>
  );
}

function AccountMenu({ email }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="focus-ring flex items-center gap-2 rounded-md py-1 pl-1 pr-1.5 text-sm text-ink-secondary transition-colors hover:bg-surface-overlay"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded bg-jade-400/15 text-2xs font-semibold text-jade-300">
          {(email || "?").slice(0, 1).toUpperCase()}
        </span>
        <ChevronDown size={13} className={`text-ink-faint transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: DUR.sm, ease: EASE }}
            className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-lg bg-surface-raised p-1 shadow-lift ring-1 ring-inset ring-surface-line"
          >
            <p className="truncate px-2.5 py-2 text-xs text-ink-muted">{email}</p>
            <div className="my-1 h-px bg-surface-line" />
            <MenuLink to="/faq" icon={HelpCircle} label="Help & FAQ" onDone={() => setOpen(false)} />
            <MenuLink to="/settings" icon={Settings} label="Settings" onDone={() => setOpen(false)} />
            <div className="my-1 h-px bg-surface-line" />
            <button
              onClick={() => {
                localStorage.removeItem("duenorth_email");
                navigate("/login");
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink-secondary transition-colors hover:bg-surface-overlay hover:text-ink-primary"
            >
              <LogOut size={14} className="text-ink-faint" />
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuLink({ to, icon: Icon, label, onDone }) {
  return (
    <NavLink
      to={to}
      onClick={onDone}
      className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink-secondary transition-colors hover:bg-surface-overlay hover:text-ink-primary"
    >
      <Icon size={14} className="text-ink-faint" />
      {label}
    </NavLink>
  );
}

export default function Header({ email }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-[70] border-b border-surface-line bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[52px] max-w-[1400px] items-center gap-5 px-5 lg:px-7">
        <Mark />
        <span className="hidden h-4 w-px bg-surface-line lg:block" />
        <div className="hidden lg:block">
          <NavPills items={NAV} />
        </div>
        <div className="ml-auto flex items-center gap-4">
          <RateStrip />
          <span className="hidden h-4 w-px bg-surface-line md:block" />
          <AccountMenu email={email} />
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="focus-ring rounded-md p-1.5 text-ink-secondary lg:hidden"
            aria-label="Menu"
          >
            {mobileOpen ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DUR.sm }}
            className="overflow-hidden border-t border-surface-line bg-surface-base lg:hidden"
          >
            <div className="flex flex-col gap-0.5 p-3">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive ? "bg-surface-overlay text-ink-primary" : "text-ink-muted"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
