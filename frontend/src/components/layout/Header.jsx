import { LogOut, Menu } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";

import { NAV_TABS } from "../../utils/constants";

export default function Header({ email, onToggleSidebar }) {
  const navigate = useNavigate();

  const signOut = () => {
    localStorage.removeItem("duenorth_email");
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-sage-300 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4">
        <button
          onClick={onToggleSidebar}
          className="rounded p-1.5 text-night-800 transition-colors hover:bg-mint-50 lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>

        <span className="font-mono text-lg font-semibold text-night-800">DueNorth</span>

        <nav className="hidden flex-1 items-center gap-1 overflow-x-auto md:flex">
          {NAV_TABS.map((tab) => (
            <NavLink
              key={tab.key}
              to={tab.path}
              end={tab.path === "/dashboard"}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-mint-100 text-mint-500"
                    : "text-night-800 hover:bg-mint-50 hover:text-mint-400"
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {email ? (
            <span className="hidden text-sm text-sage-400 sm:inline">{email}</span>
          ) : null}
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-md border border-sage-300 px-3 py-1.5 text-sm text-night-800 transition-colors hover:border-mint-300 hover:text-mint-400"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
