import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { api } from "../api/client";
import { useToast } from "../components/layout/Toast";
import EmptyState from "../components/ui/EmptyState";
import SkeletonCard from "../components/ui/SkeletonCard";
import StatusBadge from "../components/ui/StatusBadge";

const ACTIONS = [
  { key: "approve", label: "Approve", cls: "border-mint-300 text-mint-500 hover:bg-mint-100" },
  { key: "escalate", label: "Escalate", cls: "border-blush-300 text-blush-400 hover:bg-blush-100" },
  { key: "hold", label: "Hold", cls: "border-sage-300 text-sage-400 hover:bg-sage-100" },
];

const PAGE = 25;

export default function HumanReviewPage() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(null);
  const [limit, setLimit] = useState(PAGE);

  const load = () => {
    setLoading(true);
    api
      .getHumanReview()
      .then((d) => setItems(d))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const act = async (id, action) => {
    setPending(id);
    // optimistic remove
    setItems((prev) => prev.filter((x) => x.id !== id));
    try {
      const updated = await api.reviewAction(id, action);
      toast(`${updated.invoice_id_masked} → ${updated.status.replace(/_/g, " ")}`, "success");
    } catch (e) {
      toast(e?.response?.data?.detail || "Action failed", "error");
      load();
    } finally {
      setPending(null);
    }
  };

  const pendingItems = (items || []).filter(
    (i) => i.status === "PENDING_HUMAN_APPROVAL",
  );
  const shown = pendingItems.slice(0, limit);

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-night-800">Human Review Queue</h2>
        {pendingItems.length > 0 ? (
          <span className="text-sm text-sage-400">
            {pendingItems.length} pending
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : pendingItems.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No items pending review — all invoices are being handled automatically"
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {shown.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -40 }}
                className="flex flex-col gap-3 rounded-xl border border-sage-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-night-800">
                    {item.invoice_id_masked}
                  </span>
                  <StatusBadge value={item.reason} />
                  <span className="text-xs text-sage-400">{item.created_at}</span>
                </div>
                <div className="flex gap-2">
                  {ACTIONS.map((a) => (
                    <button
                      key={a.key}
                      disabled={pending === item.id}
                      onClick={() => act(item.id, a.key)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${a.cls}`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {pendingItems.length > shown.length ? (
            <button
              onClick={() => setLimit((l) => l + PAGE)}
              className="rounded-md border border-sage-300 px-3 py-1.5 text-sm text-night-800 transition-colors hover:border-mint-300 hover:text-mint-400"
            >
              Load more ({pendingItems.length - shown.length} remaining)
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
