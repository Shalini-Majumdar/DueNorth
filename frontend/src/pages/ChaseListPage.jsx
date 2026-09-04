import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Inbox } from "lucide-react";

import { api } from "@/api/client";
import CommandBar from "@/components/layout/CommandBar";
import InvoiceDrawer from "@/components/invoice/InvoiceDrawer";
import { useApi } from "@/hooks/useApi";
import {
  AnimatedList,
  EmptyState,
  GradualBlur,
  Meter,
  Money,
  PageHeader,
  SkeletonRows,
  Tabs,
  TONE_DOT,
  cn,
  nextAction,
  riskTone,
  sectorLabel,
} from "@/ui";
import { formatCompactCurrency } from "@/utils/formatCurrency";

const FILTERS = {
  all: () => true,
  high: (r) => r.pred_late_prob > 0.7,
  watch: (r) => r.pred_late_prob >= 0.4 && r.pred_late_prob <= 0.7,
  aged: (r) => r.days_past_due > 45,
};

const GRID =
  "grid grid-cols-[26px_84px_minmax(0,1fr)_120px_46px_98px_16px] items-center gap-3 " +
  "lg:grid-cols-[26px_84px_minmax(0,1fr)_120px_46px_98px_150px_16px]";

export default function ChaseListPage({ onAgentRun, ranAt }) {
  const { data, loading, error, refetch } = useApi(() => api.getOverdue(), []);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const prevOrder = useRef([]);
  const [movers, setMovers] = useState(new Set());

  useEffect(() => {
    if (ranAt) refetch();
  }, [ranAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => (data || []).filter(FILTERS[filter]).slice(0, 60), [data, filter]);

  useEffect(() => {
    const ids = rows.map((r) => r.invoice_id_masked);
    if (prevOrder.current.length && prevOrder.current.join() !== ids.join()) {
      setMovers(new Set(ids.filter((id, i) => prevOrder.current[i] !== id)));
      const t = setTimeout(() => setMovers(new Set()), 1800);
      prevOrder.current = ids;
      return () => clearTimeout(t);
    }
    prevOrder.current = ids;
  }, [rows]);

  const counts = useMemo(
    () => ({
      all: (data || []).length,
      high: (data || []).filter(FILTERS.high).length,
      watch: (data || []).filter(FILTERS.watch).length,
      aged: (data || []).filter(FILTERS.aged).length,
    }),
    [data],
  );

  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Every overdue invoice, ranked by predicted late risk against the amount at stake."
        actions={<CommandBar onAgentRun={onAgentRun} />}
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "high", label: "High risk", count: counts.high },
            { value: "watch", label: "Watch", count: counts.watch },
            { value: "aged", label: "45+ days", count: counts.aged },
          ]}
        />
        <p className="text-xs text-ink-muted">
          <span className="font-mono tnum text-ink-secondary">{rows.length}</span> shown ·{" "}
          <span className="font-mono tnum text-ink-secondary">{formatCompactCurrency(total)}</span> at stake
        </p>
      </div>

      {/* column header — open table, no card */}
      <div
        className={cn(
          GRID,
          "sticky top-[52px] z-20 border-y border-surface-line bg-canvas/90 py-2 pl-3 pr-1 text-2xs font-medium uppercase tracking-wider text-ink-faint backdrop-blur",
        )}
      >
        <span />
        <span>Invoice</span>
        <span>Sector</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Days</span>
        <span className="text-right">Late risk</span>
        <span className="hidden lg:block">Next action</span>
        <span />
      </div>

      {loading ? (
        <SkeletonRows rows={10} />
      ) : error ? (
        <EmptyState icon={Inbox} title="Could not load invoices" subtitle={String(error)} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Inbox} title="Nothing here" subtitle="No invoices match this filter." />
      ) : (
        <div className="relative">
          <AnimatedList
            items={rows}
            getKey={(r) => r.invoice_id_masked}
            highlightKeys={movers}
            gap="gap-0"
            onSelect={setSelected}
            renderItem={(r, i) => {
              const tone = riskTone(r.pred_late_prob);
              const aged = r.days_past_due > 45;
              return (
                <div
                  className={cn(
                    GRID,
                    "group relative border-b border-surface-line py-2.5 pl-3 pr-1 transition-colors hover:bg-surface-raised",
                  )}
                >
                  <span className={cn("absolute inset-y-1.5 left-0 w-[2px] rounded-full", TONE_DOT[tone])} />
                  <span className="font-mono text-2xs tnum text-ink-faint">{i + 1}</span>
                  <span className="font-mono text-[13px] text-ink-primary">{r.invoice_id_masked}</span>
                  <span className="truncate text-[13px] text-ink-secondary">{sectorLabel(r.sector)}</span>
                  <span className="text-right">
                    <Money amount={r.amount} size="sm" />
                  </span>
                  <span
                    className={cn(
                      "text-right font-mono text-[13px] tnum",
                      aged ? "text-coral-300" : "text-ink-muted",
                    )}
                  >
                    {r.days_past_due}
                  </span>
                  <span className="flex items-center justify-end gap-2">
                    <Meter value={r.pred_late_prob} tone={tone} width="w-10" />
                    <span className="w-8 text-right font-mono text-[13px] tnum text-ink-secondary">
                      {(r.pred_late_prob * 100).toFixed(0)}%
                    </span>
                  </span>
                  <span className="hidden truncate text-xs text-ink-muted lg:block">
                    {nextAction(r.days_past_due)}
                  </span>
                  <ChevronRight
                    size={14}
                    className="text-ink-faint transition-colors group-hover:text-jade-300"
                  />
                </div>
              );
            }}
          />
          <GradualBlur position="bottom" height="3.5rem" strength={1.5} divCount={4} opacity={0.9} />
        </div>
      )}

      <InvoiceDrawer row={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
