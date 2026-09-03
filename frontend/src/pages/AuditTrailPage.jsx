import { motion } from "framer-motion";
import { ScrollText } from "lucide-react";
import { useMemo, useState } from "react";

import { api } from "../api/client";
import EmptyState from "../components/ui/EmptyState";
import { useApi } from "../hooks/useApi";
import { AUDIT_ACTIONS } from "../utils/constants";

const DOT = {
  payment_captured: "bg-mint-300",
  held: "bg-sage-300",
  escalated_msefc: "bg-blush-300",
  payment_link_created: "bg-night-800",
};

const PAGE = 50;

export default function AuditTrailPage() {
  const [invoiceId, setInvoiceId] = useState("");
  const [action, setAction] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const params = useMemo(() => {
    const p = {};
    if (invoiceId.trim()) p.invoice_id = invoiceId.trim();
    if (action) p.action = action;
    return p;
  }, [invoiceId, action]);

  const { data, loading, error } = useApi(
    () => api.getAuditLog(params),
    [params.invoice_id, params.action],
  );

  const rows = (data || []).slice(0, limit);

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-night-800">Audit Trail</h2>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          value={invoiceId}
          onChange={(e) => setInvoiceId(e.target.value)}
          placeholder="Filter by invoice ID"
          className="rounded-lg border border-sage-300 px-3 py-2 text-sm outline-none focus:border-mint-300 focus:ring-2 focus:ring-mint-100"
        />
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="rounded-lg border border-sage-300 px-3 py-2 text-sm outline-none focus:border-mint-300 focus:ring-2 focus:ring-mint-100"
        >
          <option value="">All actions</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-sage-100" />
          ))}
        </div>
      ) : error ? (
        <EmptyState icon={ScrollText} title="Could not load the audit log" subtitle={String(error)} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No audit events yet"
          subtitle="Run the agent from the sidebar to generate activity."
        />
      ) : (
        <div className="relative pl-6">
          <div className="absolute bottom-0 left-2 top-0 w-px bg-sage-200" />
          {rows.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 20) * 0.03 }}
              className="relative mb-4"
            >
              <span
                className={`absolute -left-[1.15rem] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                  DOT[r.action] || "bg-sage-400"
                }`}
              />
              <div className="rounded-lg border border-sage-200 bg-white p-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-mono text-xs text-sage-400">{r.ts}</span>
                  <span className="font-mono text-night-800">{r.invoice_id_masked}</span>
                  <span className="rounded bg-mint-50 px-1.5 py-0.5 text-xs text-mint-500">
                    {r.action}
                  </span>
                  <span className="text-xs text-sage-400">step: {r.step}</span>
                  {r.razorpay_id ? (
                    <span className="font-mono text-xs text-sage-400">{r.razorpay_id}</span>
                  ) : null}
                </div>
              </div>
            </motion.div>
          ))}
          {data && data.length > limit ? (
            <button
              onClick={() => setLimit((l) => l + PAGE)}
              className="ml-1 mt-2 rounded-md border border-sage-300 px-3 py-1.5 text-sm text-night-800 transition-colors hover:border-mint-300 hover:text-mint-400"
            >
              Load more ({data.length - limit} remaining)
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
