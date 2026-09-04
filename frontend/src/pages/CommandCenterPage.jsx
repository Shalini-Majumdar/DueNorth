import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, ArrowUpRight, Inbox } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { api } from "@/api/client";
import CommandBar from "@/components/layout/CommandBar";
import { useApi } from "@/hooks/useApi";
import {
  ACTION_META,
  AnimatedList,
  DUR,
  EASE,
  EmptyState,
  Eyebrow,
  Figure,
  Money,
  PageHeader,
  Panel,
  RiskBadge,
  SectionHeader,
  Skeleton,
  SkeletonRows,
  Stat,
  StatRail,
  TONE_DOT,
  cn,
  riskTone,
  sectorLabel,
} from "@/ui";

/* ── The hero financial story: exposure on the left, recovery on the right,
      with an explicit flow between them. Open layout, no cards. ───────────── */
function HeroStory({ atRisk, projected, lift, liftPct, count, mix, loading }) {
  if (loading) {
    return (
      <div className="grid gap-10 py-2 lg:grid-cols-[1fr_auto_1fr]">
        <div className="space-y-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-14 w-72" />
          <Skeleton className="h-1.5 w-full" />
        </div>
        <div className="hidden w-px bg-surface-line lg:block" />
        <div className="space-y-3">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-14 w-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid items-center gap-8 py-1 lg:grid-cols-[1fr_auto_1fr] lg:gap-10">
      {/* Exposure */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DUR.lg, ease: EASE }}
      >
        <div className="flex items-center gap-2.5">
          <Eyebrow>Money at risk</Eyebrow>
          <span className="rounded bg-surface-overlay px-1.5 py-0.5 font-mono text-2xs tnum text-ink-muted ring-1 ring-inset ring-surface-line">
            {count} overdue
          </span>
        </div>
        <div className="mt-3">
          <Money amount={atRisk} tone="risk" size="display" animate />
        </div>

        {/* composition of exposure by risk tier — inline data, not a card */}
        <div className="mt-5 max-w-md">
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-line">
            {mix.map((m) =>
              m.value > 0 ? (
                <motion.span
                  key={m.key}
                  initial={{ width: 0 }}
                  animate={{ width: `${m.pct}%` }}
                  transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
                  className={cn("h-full", TONE_DOT[m.tone])}
                />
              ) : null,
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1">
            {mix.map((m) => (
              <span key={m.key} className="flex items-center gap-1.5 text-2xs text-ink-muted">
                <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[m.tone])} />
                {m.label}
                <span className="font-mono tnum text-ink-faint">{m.pct.toFixed(0)}%</span>
              </span>
            ))}
          </div>
        </div>
      </motion.div>

      {/* flow */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: DUR.lg, delay: 0.2 }}
        className="hidden flex-col items-center gap-2 lg:flex"
      >
        <span className="h-16 w-px bg-gradient-to-b from-transparent via-surface-edge to-transparent" />
        <ArrowRight size={14} className="text-ink-faint" />
        <span className="h-16 w-px bg-gradient-to-b from-transparent via-surface-edge to-transparent" />
      </motion.div>

      {/* Recovery */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DUR.lg, ease: EASE, delay: 0.08 }}
      >
        <Eyebrow>Projected recovery · 90 days</Eyebrow>
        <div className="mt-3">
          <Money amount={projected} tone="recovered" size="display" animate />
        </div>
        <p className="mt-5 max-w-sm text-sm leading-relaxed text-ink-secondary">
          Recovered if invoices are worked in AI-ranked order.
        </p>
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-muted">
          <span className="font-mono tnum text-jade-300">
            ₹{Math.round(lift).toLocaleString("en-IN")}
          </span>{" "}
          ahead of oldest-first — {liftPct.toFixed(1)}% better by day 90.
        </p>
      </motion.div>
    </div>
  );
}

export default function CommandCenterPage({ onAgentRun, ranAt }) {
  const navigate = useNavigate();
  const lift = useApi(() => api.getLift(), []);
  const overdue = useApi(() => api.getOverdue(), []);
  const review = useApi(() => api.getHumanReview(), []);
  const audit = useApi(() => api.getAuditLog({}), []);

  const prevOrder = useRef([]);
  const prevEvents = useRef(new Set());
  const [movers, setMovers] = useState(new Set());
  const [freshEvents, setFreshEvents] = useState(new Set());

  useEffect(() => {
    if (!ranAt) return;
    lift.refetch();
    overdue.refetch();
    audit.refetch();
    review.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranAt]);

  const rows = useMemo(() => (overdue.data || []).slice(0, 7), [overdue.data]);

  // rank movement after an agent run
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

  // newly-arrived activity
  const events = useMemo(() => (audit.data || []).slice(0, 9), [audit.data]);
  useEffect(() => {
    const ids = new Set(events.map((e) => e.id));
    if (prevEvents.current.size) {
      const fresh = new Set([...ids].filter((id) => !prevEvents.current.has(id)));
      if (fresh.size) {
        setFreshEvents(fresh);
        const t = setTimeout(() => setFreshEvents(new Set()), 1800);
        prevEvents.current = ids;
        return () => clearTimeout(t);
      }
    }
    prevEvents.current = ids;
  }, [events]);

  const pending = (review.data || []).filter((r) => r.status === "PENDING_HUMAN_APPROVAL").length;
  const all = overdue.data || [];
  const avgDays = all.length ? Math.round(all.reduce((s, r) => s + r.days_past_due, 0) / all.length) : 0;

  const mix = useMemo(() => {
    const total = all.reduce((s, r) => s + r.amount, 0) || 1;
    const bucket = { coral: 0, amber: 0, jade: 0 };
    all.forEach((r) => {
      bucket[riskTone(r.pred_late_prob)] += r.amount;
    });
    return [
      { key: "high", tone: "coral", label: "High risk", value: bucket.coral, pct: (bucket.coral / total) * 100 },
      { key: "watch", tone: "amber", label: "Watch", value: bucket.amber, pct: (bucket.amber / total) * 100 },
      { key: "low", tone: "jade", label: "Low risk", value: bucket.jade, pct: (bucket.jade / total) * 100 },
    ];
  }, [all]);

  return (
    <div>
      <PageHeader
        title="Command centre"
        subtitle="Live exposure across every overdue invoice DueNorth is working."
        actions={<CommandBar onAgentRun={onAgentRun} />}
      />

      <HeroStory
        loading={lift.loading || overdue.loading}
        atRisk={lift.data?.total_at_risk ?? 0}
        projected={lift.data?.ai_curve?.[90] ?? 0}
        lift={lift.data?.lift_day_90 ?? 0}
        liftPct={lift.data?.lift_pct_90 ?? 0}
        count={all.length || "—"}
        mix={mix}
      />

      <StatRail className="mt-9">
        <Stat label="Lift vs oldest-first" hint="by day 90" onClick={() => navigate("/dashboard/lift")}>
          <Money amount={lift.data?.lift_day_90 ?? 0} tone="recovered" size="xl" animate />
        </Stat>
        <Stat label="Awaiting review" hint="needs a decision" onClick={() => navigate("/human-review")}>
          <Figure value={pending} size="xl" tone={pending > 0 ? "warn" : "default"} />
        </Stat>
        <Stat label="Overdue invoices" hint="past appointed day" onClick={() => navigate("/dashboard/chase")}>
          <Figure value={all.length} size="xl" />
        </Stat>
        <Stat label="Avg days overdue" hint="across the book">
          <Figure value={avgDays} size="xl" tone={avgDays > 45 ? "risk" : "default"} />
        </Stat>
      </StatRail>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* Priority queue — open rows, risk rail on the left edge */}
        <section>
          <SectionHeader
            title="Highest priority now"
            hint="late-risk × amount"
            action={
              <button
                onClick={() => navigate("/dashboard/chase")}
                className="focus-ring flex items-center gap-1 rounded text-xs text-ink-muted transition-colors hover:text-jade-300"
              >
                All invoices <ArrowUpRight size={12} />
              </button>
            }
          />
          {overdue.loading ? (
            <SkeletonRows rows={6} />
          ) : rows.length === 0 ? (
            <EmptyState icon={Inbox} title="Nothing overdue" />
          ) : (
            <AnimatedList
              items={rows}
              getKey={(r) => r.invoice_id_masked}
              highlightKeys={movers}
              gap="gap-0"
              onSelect={() => navigate("/dashboard/chase")}
              renderItem={(r) => (
                <div className="group relative flex items-center gap-3 border-b border-surface-line py-2.5 pl-3 pr-1 transition-colors hover:bg-surface-raised/70">
                  <span
                    className={cn(
                      "absolute inset-y-1.5 left-0 w-[2px] rounded-full",
                      TONE_DOT[riskTone(r.pred_late_prob)],
                    )}
                  />
                  <span className="font-mono text-[13px] text-ink-primary">{r.invoice_id_masked}</span>
                  <span className="truncate text-xs text-ink-faint">{sectorLabel(r.sector)}</span>
                  <span className="ml-auto flex items-center gap-3">
                    <span className="font-mono text-2xs tnum text-ink-muted">{r.days_past_due}d</span>
                    <RiskBadge prob={r.pred_late_prob} />
                    <Money amount={r.amount} size="sm" />
                  </span>
                </div>
              )}
            />
          )}
        </section>

        {/* Activity stream — timeline rail, not a feed of cards */}
        <section>
          <SectionHeader
            title="Autonomous activity"
            action={
              <button
                onClick={() => navigate("/audit")}
                className="focus-ring flex items-center gap-1 rounded text-xs text-ink-muted transition-colors hover:text-jade-300"
              >
                Full log <ArrowUpRight size={12} />
              </button>
            }
          />
          {audit.loading ? (
            <SkeletonRows rows={6} />
          ) : events.length === 0 ? (
            <EmptyState icon={Inbox} title="No activity yet" subtitle="Run the agent to start working the ledger." />
          ) : (
            <div className="relative pl-4">
              <span className="absolute inset-y-1 left-0 w-px bg-surface-line" />
              <AnimatedList
                items={events}
                getKey={(e) => e.id}
                highlightKeys={freshEvents}
                gap="gap-0"
                renderItem={(e) => {
                  const meta = ACTION_META[e.action] || { label: e.action, tone: "neutral" };
                  return (
                    <div className="relative py-2 pl-3">
                      <span
                        className={cn(
                          "absolute -left-[4.5px] top-3 h-[7px] w-[7px] rounded-full ring-[3px] ring-canvas",
                          TONE_DOT[meta.tone],
                        )}
                      />
                      <div className="flex items-baseline gap-2">
                        <span className="text-[13px] text-ink-secondary">{meta.label}</span>
                        <span className="font-mono text-2xs text-ink-faint">{e.invoice_id_masked}</span>
                        <span className="ml-auto font-mono text-2xs tnum text-ink-faint">
                          {e.ts?.slice(11, 16)}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
