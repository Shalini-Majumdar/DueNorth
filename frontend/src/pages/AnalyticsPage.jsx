import { useMemo } from "react";
import { BarChart3 } from "lucide-react";

import { api } from "@/api/client";
import LiftChart from "@/components/charts/LiftChart";
import { useApi } from "@/hooks/useApi";
import {
  EmptyState,
  Eyebrow,
  Figure,
  Money,
  PageHeader,
  Panel,
  SectionHeader,
  Skeleton,
  Stat,
  StatRail,
  TONE_DOT,
  cn,
  riskTone,
  sectorLabel,
} from "@/ui";

/** Exposure concentration by sector — inline bars, no chart library needed. */
function Concentration({ rows }) {
  const bars = useMemo(() => {
    const by = {};
    rows.forEach((r) => {
      by[r.sector] = (by[r.sector] || 0) + r.amount;
    });
    const total = Object.values(by).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(by)
      .map(([sector, amount]) => ({ sector, amount, pct: (amount / total) * 100 }))
      .sort((a, b) => b.amount - a.amount);
  }, [rows]);

  return (
    <div className="space-y-3">
      {bars.map((b) => (
        <div key={b.sector}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] text-ink-secondary">{sectorLabel(b.sector)}</span>
            <span className="font-mono text-2xs tnum text-ink-muted">
              ₹{Math.round(b.amount).toLocaleString("en-IN")}
              <span className="ml-2 text-ink-faint">{b.pct.toFixed(0)}%</span>
            </span>
          </div>
          <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-surface-line">
            <span className="block h-full rounded-full bg-steel-400" style={{ width: `${b.pct}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const lift = useApi(() => api.getLift(), []);
  const overdue = useApi(() => api.getOverdue(), []);
  const d = lift.data;

  const riskSplit = useMemo(() => {
    const rows = overdue.data || [];
    const total = rows.reduce((s, r) => s + r.amount, 0) || 1;
    const b = { coral: 0, amber: 0, jade: 0 };
    rows.forEach((r) => (b[riskTone(r.pred_late_prob)] += r.amount));
    return [
      { tone: "coral", label: "High risk", amount: b.coral, pct: (b.coral / total) * 100 },
      { tone: "amber", label: "Watch", amount: b.amber, pct: (b.amber / total) * 100 },
      { tone: "jade", label: "Low risk", amount: b.jade, pct: (b.jade / total) * 100 },
    ];
  }, [overdue.data]);

  return (
    <div>
      <PageHeader
        title="Recovery analytics"
        subtitle="What AI-ranked collection recovers against working the book oldest-first."
      />

      {lift.loading ? (
        <div className="space-y-8">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-[320px] w-full rounded-xl" />
        </div>
      ) : lift.error ? (
        <EmptyState icon={BarChart3} title="Could not load analytics" subtitle={String(lift.error)} />
      ) : (
        <>
          {/* headline comparison — the AI-vs-baseline story stated plainly */}
          <div className="grid items-end gap-8 border-b border-surface-line pb-7 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <div>
              <Eyebrow>AI-ranked · day 90</Eyebrow>
              <div className="mt-2.5">
                <Money amount={d.ai_curve[90]} tone="recovered" size="hero" animate />
              </div>
              <span className="mt-3 inline-flex items-center gap-1.5 text-2xs text-ink-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-jade-400" /> risk × amount ordering
              </span>
            </div>
            <div className="hidden h-14 w-px bg-surface-line lg:block" />
            <div>
              <Eyebrow>Oldest-first · day 90</Eyebrow>
              <div className="mt-2.5">
                <Money amount={d.base_curve[90]} tone="info" size="hero" animate />
              </div>
              <span className="mt-3 inline-flex items-center gap-1.5 text-2xs text-ink-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-steel-400" /> what most teams do today
              </span>
            </div>
          </div>

          <StatRail className="mt-0 border-t-0">
            {[30, 60, 90].map((day) => (
              <Stat key={day} label={`Day ${day} advantage`} hint={`+${d[`lift_pct_${day}`].toFixed(1)}% over baseline`}>
                <Money amount={d[`lift_day_${day}`]} tone="recovered" size="xl" animate />
              </Stat>
            ))}
            <Stat label="Invoices simulated" hint="the current overdue book">
              <Figure value={d.n_invoices} size="xl" />
            </Stat>
          </StatRail>

          <div className="mt-10">
            <SectionHeader title="Cumulative recovery" hint="₹ recovered by day, both strategies" />
            <Panel className="p-5">
              <LiftChart aiCurve={d.ai_curve} baseCurve={d.base_curve} />
            </Panel>
            <p className="mt-3 text-xs text-ink-faint">
              Simulated on the current ledger. Real-world lift depends on your invoice mix and buyer behaviour.
            </p>
          </div>

          <div className="mt-10 grid gap-10 lg:grid-cols-2">
            <section>
              <SectionHeader title="Exposure by risk tier" hint="share of money at risk" />
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-line">
                {riskSplit.map((s) =>
                  s.pct > 0 ? (
                    <span key={s.label} className={cn("h-full", TONE_DOT[s.tone])} style={{ width: `${s.pct}%` }} />
                  ) : null,
                )}
              </div>
              <div className="mt-4 divide-y divide-surface-line">
                {riskSplit.map((s) => (
                  <div key={s.label} className="flex items-center justify-between py-2.5">
                    <span className="flex items-center gap-2 text-[13px] text-ink-secondary">
                      <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[s.tone])} />
                      {s.label}
                    </span>
                    <span className="font-mono text-[13px] tnum text-ink-muted">
                      ₹{Math.round(s.amount).toLocaleString("en-IN")}
                      <span className="ml-2.5 text-ink-faint">{s.pct.toFixed(0)}%</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <SectionHeader title="Exposure by sector" hint="where the money is concentrated" />
              {overdue.loading ? <Skeleton className="h-40 w-full" /> : <Concentration rows={overdue.data || []} />}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
