import { motion } from "framer-motion";
import { ChevronDown, Inbox } from "lucide-react";
import { useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";

import { api } from "../api/client";
import LiftChart from "../components/charts/LiftChart";
import { useToast } from "../components/layout/Toast";
import EmptyState from "../components/ui/EmptyState";
import MetricCard from "../components/ui/MetricCard";
import RiskBadge from "../components/ui/RiskBadge";
import SkeletonTable from "../components/ui/SkeletonTable";
import { useApi } from "../hooks/useApi";
import { COLORS } from "../utils/constants";
import { formatCurrency, formatPercent } from "../utils/formatCurrency";

const subTabs = [
  { to: "/dashboard", label: "Chase List", end: true },
  { to: "/dashboard/lift", label: "Recovery Lift", end: false },
];

function SubNav() {
  return (
    <div className="mb-6 flex gap-1 border-b border-sage-200">
      {subTabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            `-mb-px border-b-2 px-4 py-2 text-sm transition-colors ${
              isActive
                ? "border-mint-300 text-night-800"
                : "border-transparent text-sage-400 hover:text-mint-400"
            }`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}

function pctPill(p) {
  if (p > 0.7) return "bg-blush-200 text-blush-400";
  if (p >= 0.4) return "bg-sage-200 text-sage-400";
  return "bg-mint-100 text-mint-500";
}

function ChaseRow({ row, index }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !detail) {
      setLoading(true);
      try {
        const d = await api.calcInterest({
          principal: row.amount,
          due_date: "2026-01-01",
          days_overdue: Math.max(row.days_past_due, 1),
        });
        setDetail(d);
      } catch {
        setDetail({ error: true });
      } finally {
        setLoading(false);
      }
    }
  };

  const step =
    row.days_past_due > 30 ? "formal" : row.days_past_due > 15 ? "firm" : "polite";

  return (
    <>
      <motion.tr
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03 }}
        onClick={toggle}
        className="cursor-pointer border-b border-sage-100 transition-all duration-200 hover:bg-mint-50"
      >
        <td className="px-4 py-3 font-mono text-sm text-night-800">{row.invoice_id_masked}</td>
        <td className="px-4 py-3 text-sm capitalize text-night-800">{row.sector}</td>
        <td className="px-4 py-3 text-right font-mono text-sm text-night-800">
          {formatCurrency(row.amount)}
        </td>
        <td className="px-4 py-3 text-right text-sm text-night-800">{row.days_past_due}</td>
        <td className="px-4 py-3 text-right">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${pctPill(row.pred_late_prob)}`}>
            {formatPercent(row.pred_late_prob * 100, 0)}
          </span>
        </td>
        <td className="px-4 py-3 text-right font-mono text-sm text-night-800">
          {formatCurrency(row.priority_score)}
        </td>
        <td className="px-2 py-3 text-sage-400">
          <ChevronDown
            size={16}
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </td>
      </motion.tr>
      {open ? (
        <tr className="bg-mint-50/60">
          <td colSpan={7} className="px-4 py-4">
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div>
                <span className="text-sage-400">Interest accrued: </span>
                <span className="font-mono text-night-800">
                  {loading
                    ? "…"
                    : detail?.error
                      ? "n/a"
                      : formatCurrency(detail?.interest ?? 0, { decimals: true })}
                </span>
              </div>
              <div>
                <span className="text-sage-400">Dunning step: </span>
                <span className="font-medium capitalize text-night-800">{step}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toast(`Reminder queued for ${row.invoice_id_masked} (dry run)`, "info");
                }}
                className="rounded-md border border-mint-300 px-3 py-1 text-xs text-mint-500 transition-colors hover:bg-mint-100"
              >
                Send reminder
              </button>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function ChaseList() {
  const { data, loading, error } = useApi(() => api.getOverdue(), []);

  const totalAtRisk = (data || []).reduce((s, r) => s + r.amount, 0);
  const avgDays =
    data && data.length
      ? data.reduce((s, r) => s + r.days_past_due, 0) / data.length
      : 0;

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="At Risk"
          value={totalAtRisk}
          format={(n) => formatCurrency(n)}
          accent={COLORS.mint300}
        />
        <MetricCard
          label="Invoices Overdue"
          value={data?.length || 0}
          accent={COLORS.blush300}
        />
        <MetricCard
          label="Avg Days Overdue"
          value={avgDays}
          format={(n) => Math.round(n).toString()}
          accent={COLORS.sage300}
        />
      </div>

      <h2 className="mb-3 text-lg font-semibold text-night-800">
        Overdue Invoices — AI Ranked
      </h2>

      {loading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : error ? (
        <EmptyState icon={Inbox} title="Could not load invoices" subtitle={String(error)} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={Inbox} title="No overdue invoices — your books are clean" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-sage-200">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="bg-mint-50 text-left text-xs font-medium uppercase tracking-wide text-sage-400">
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Sector</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Days Overdue</th>
                <th className="px-4 py-3 text-right">P(Late)</th>
                <th className="px-4 py-3 text-right">Priority</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 100).map((row, i) => (
                <ChaseRow key={row.invoice_id_masked + i} row={row} index={i} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RecoveryLift() {
  const { data, loading, error } = useApi(() => api.getLift(), []);

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-night-800">
        AI Chase Order vs Oldest-First Baseline
      </h2>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-sage-100" />
            ))}
          </div>
          <div className="h-[380px] rounded-xl bg-sage-100" />
        </div>
      ) : error ? (
        <EmptyState title="Could not load lift data" subtitle={String(error)} />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[30, 60, 90].map((d) => (
              <div
                key={d}
                className="rounded-xl bg-white p-6 shadow-sm"
                style={{ borderTop: `3px solid ${COLORS.mint400}` }}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-sage-400">
                  Day {d} Lift
                </p>
                <p className="mt-2 text-2xl font-bold text-mint-400">
                  +{formatCurrency(data[`lift_day_${d}`])}
                </p>
                <p className="mt-1 text-sm text-sage-400">
                  {formatPercent(data[`lift_pct_${d}`])} over baseline
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-sage-200 bg-white p-4">
            <LiftChart aiCurve={data.ai_curve} baseCurve={data.base_curve} />
          </div>
          <p className="mt-3 text-sm text-sage-400">
            Measured on synthetic ledger. Real-world lift will vary.
          </p>
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div>
      <SubNav />
      <Routes>
        <Route index element={<ChaseList />} />
        <Route path="lift" element={<RecoveryLift />} />
      </Routes>
    </div>
  );
}
