import { motion } from "framer-motion";
import { useMemo, useState } from "react";

import { api } from "../api/client";
import { useToast } from "../components/layout/Toast";
import { formatCurrency } from "../utils/formatCurrency";

function isoDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(iso) {
  const then = new Date(iso + "T00:00:00Z").getTime();
  const now = Date.now();
  return Math.max(0, Math.round((now - then) / 86400000));
}

export default function InterestPage() {
  const toast = useToast();
  const [principal, setPrincipal] = useState(500000);
  const [dueDate, setDueDate] = useState(isoDaysAgo(90));
  const [daysOverdue, setDaysOverdue] = useState(90);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const principalDisplay = useMemo(
    () => new Intl.NumberFormat("en-IN").format(Number(principal) || 0),
    [principal],
  );

  const onDueDate = (v) => {
    setDueDate(v);
    setDaysOverdue(daysBetween(v));
  };

  const calculate = async () => {
    setBusy(true);
    try {
      const d = await api.calcInterest({
        principal: Number(principal),
        due_date: dueDate,
        days_overdue: Number(daysOverdue),
      });
      setResult(d);
    } catch (e) {
      toast(e?.response?.data?.detail || "Calculation failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const generateNotice = async () => {
    try {
      const r = await api.prefillDemand({
        principal: Number(principal),
        due_date: dueDate,
        days_overdue: Number(daysOverdue),
      });
      toast(`Draft demand notice generated — ${r.status}`, "success");
    } catch (e) {
      toast(e?.response?.data?.detail || "Could not generate notice", "error");
    }
  };

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-night-800">
        Section 16 Interest — Live Demo
      </h2>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-xl border border-sage-200 bg-white p-6">
          <label className="block text-sm font-medium text-night-800">Principal (Rs)</label>
          <input
            inputMode="numeric"
            value={principalDisplay}
            onChange={(e) => setPrincipal(e.target.value.replace(/[^\d]/g, ""))}
            className="mt-1 w-full rounded-lg border border-sage-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-mint-300 focus:ring-2 focus:ring-mint-100"
          />

          <label className="mt-4 block text-sm font-medium text-night-800">
            Invoice Due Date
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => onDueDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-sage-300 px-3 py-2.5 text-sm outline-none focus:border-mint-300 focus:ring-2 focus:ring-mint-100"
          />

          <label className="mt-4 block text-sm font-medium text-night-800">
            Days Overdue
          </label>
          <input
            type="number"
            min={0}
            value={daysOverdue}
            onChange={(e) => setDaysOverdue(e.target.value)}
            className="mt-1 w-full rounded-lg border border-sage-300 px-3 py-2.5 text-sm outline-none focus:border-mint-300 focus:ring-2 focus:ring-mint-100"
          />

          <button
            onClick={calculate}
            disabled={busy}
            className="mt-5 w-full rounded-lg bg-mint-300 px-4 py-2.5 text-sm font-semibold text-night-800 transition-colors hover:bg-mint-400 disabled:opacity-60"
          >
            {busy ? "Calculating…" : "Calculate"}
          </button>
          <p className="mt-2 text-xs text-sage-400">
            Statutory rate: 3x RBI Bank Rate (currently 16.50%)
          </p>

          <div className="mt-6 border-l-4 border-sage-400 bg-sage-100 p-3 text-xs text-night-800">
            Section 16 interest applies only to Micro/Small Udyam-registered
            suppliers. If you are registered as Medium or are unregistered,
            interest cannot be legally claimed under this provision.
          </div>
        </div>

        <div>
          {result ? (
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-xl border border-sage-200 bg-white p-6"
            >
              <p className="text-sm text-sage-400">Interest Accrued</p>
              <p className="text-2xl font-semibold text-night-800">
                {formatCurrency(result.interest, { decimals: true })}
              </p>
              <p className="mt-3 text-sm text-sage-400">Total Due</p>
              <p className="text-3xl font-bold text-mint-400">
                {formatCurrency(result.total_due, { decimals: true })}
              </p>
              <span className="mt-3 inline-flex rounded-full bg-mint-100 px-2.5 py-0.5 text-xs font-medium text-mint-500">
                {(result.statutory_rate_pa * 100).toFixed(2)}% p.a. · monthly rests
              </span>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-sage-400">
                      <th className="py-2">From</th>
                      <th className="py-2">To</th>
                      <th className="py-2 text-right">Opening</th>
                      <th className="py-2 text-right">Interest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.schedule || []).map((s, i) => (
                      <motion.tr
                        key={i}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={i % 2 ? "bg-mint-50" : "bg-white"}
                      >
                        <td className="py-1.5 font-mono text-xs">{s.from}</td>
                        <td className="py-1.5 font-mono text-xs">{s.to}</td>
                        <td className="py-1.5 text-right font-mono text-xs">
                          {formatCurrency(s.opening_balance)}
                        </td>
                        <td className="py-1.5 text-right font-mono text-xs">
                          {formatCurrency(s.interest_this_period, { decimals: true })}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={generateNotice}
                className="mt-5 w-full rounded-lg bg-night-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-night-700"
              >
                Generate Demand Notice
              </button>
              <p className="mt-2 text-xs text-sage-400">
                This is a draft under MSMED Act 2006 ss.15-16. It requires human
                review before sending.
              </p>
            </motion.div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-sage-300 p-10 text-center text-sm text-sage-400">
              Enter values and press Calculate to see the interest breakdown.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
