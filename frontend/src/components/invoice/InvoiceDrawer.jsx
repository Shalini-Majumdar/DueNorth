import { useEffect, useState } from "react";
import { FileText } from "lucide-react";

import { api } from "@/api/client";
import { useToast } from "@/components/layout/Toast";
import {
  ACTION_META,
  Button,
  Divider,
  Drawer,
  Eyebrow,
  Meter,
  Money,
  RiskBadge,
  SectionHeader,
  Skeleton,
  StageTrack,
  TONE_DOT,
  cn,
  nextAction,
  riskTone,
  sectorLabel,
  stageFor,
} from "@/ui";

/** The ledger's due dates sit in a fixed window; anchor Section 16 maths off
 *  days-overdue so the drawer shows a real, auditable calculation. */
function dueDateFor(days) {
  const d = new Date();
  d.setDate(d.getDate() - Number(days || 0));
  return d.toISOString().slice(0, 10);
}

export default function InvoiceDrawer({ row, open, onClose }) {
  const toast = useToast();
  const [interest, setInterest] = useState(null);
  const [events, setEvents] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !row) return;
    setInterest(null);
    setEvents(null);
    const due = dueDateFor(row.days_past_due);
    api
      .calcInterest({ principal: row.amount, due_date: due, days_overdue: Math.max(row.days_past_due, 1) })
      .then(setInterest)
      .catch(() => setInterest({ error: true }));
    api
      .getAuditLog({ invoice_id: row.invoice_id_masked.replace(/\D/g, "") })
      .then(setEvents)
      .catch(() => setEvents([]));
  }, [open, row]);

  const generateNotice = async () => {
    setBusy(true);
    try {
      const r = await api.prefillDemand({
        principal: row.amount,
        due_date: dueDateFor(row.days_past_due),
        days_overdue: Math.max(row.days_past_due, 1),
        invoice_id: row.invoice_id_masked,
      });
      toast(`Draft notice prepared — ${r.status.replace(/_/g, " ").toLowerCase()}. Nothing has been filed.`, "success");
    } catch (e) {
      toast(e?.response?.data?.detail || "Could not prepare notice", "error");
    } finally {
      setBusy(false);
    }
  };

  if (!row) return null;
  const tone = riskTone(row.pred_late_prob);
  const eligible = row.days_past_due > 45;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={row.invoice_id_masked}
      subtitle={`${sectorLabel(row.sector)} · ${row.days_past_due} days past appointed day`}
      badge={<RiskBadge prob={row.pred_late_prob} />}
      footer={
        eligible ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-2xs leading-relaxed text-ink-faint">
              Drafts only. DueNorth never files with the MSEFC on your behalf.
            </p>
            <Button size="sm" variant="secondary" onClick={generateNotice} disabled={busy}>
              <FileText />
              {busy ? "Preparing…" : "Prepare notice"}
            </Button>
          </div>
        ) : null
      }
    >
      {/* Exposure */}
      <Eyebrow>Outstanding</Eyebrow>
      <div className="mt-2">
        <Money amount={row.amount} tone="risk" size="hero" />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-4 border-y border-surface-line py-3.5">
        <div>
          <Eyebrow>Late risk</Eyebrow>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="font-mono text-[13px] tnum text-ink-secondary">
              {(row.pred_late_prob * 100).toFixed(0)}%
            </span>
            <Meter value={row.pred_late_prob} tone={tone} width="w-9" />
          </div>
        </div>
        <div>
          <Eyebrow>Priority</Eyebrow>
          <p className="mt-1.5 font-mono text-[13px] tnum text-ink-secondary">
            {Math.round(row.priority_score).toLocaleString("en-IN")}
          </p>
        </div>
        <div>
          <Eyebrow>Next action</Eyebrow>
          <p className="mt-1.5 text-[13px] text-ink-secondary">{nextAction(row.days_past_due)}</p>
        </div>
      </div>

      {/* Lifecycle */}
      <div className="mt-7">
        <SectionHeader title="Recovery stage" />
        <div className="pb-1 pt-2">
          <StageTrack current={stageFor(row.days_past_due)} />
        </div>
      </div>

      {/* Statutory interest — auditable trail */}
      <div className="mt-8">
        <SectionHeader title="Statutory interest" hint="MSMED Act 2006 · s.16" />
        {!interest ? (
          <div className="space-y-2.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-7 w-48" />
          </div>
        ) : interest.error ? (
          <p className="text-sm text-ink-muted">Interest could not be calculated for this invoice.</p>
        ) : (
          <>
            <div className="flex items-end justify-between gap-4">
              <div>
                <Eyebrow>Interest accrued</Eyebrow>
                <div className="mt-1.5">
                  <Money amount={interest.interest} size="lg" decimals />
                </div>
              </div>
              <div className="text-right">
                <Eyebrow>Total due</Eyebrow>
                <div className="mt-1.5">
                  <Money amount={interest.total_due} tone="recovered" size="lg" decimals />
                </div>
              </div>
            </div>
            <p className="mt-2.5 text-2xs text-ink-faint">
              {(interest.statutory_rate_pa * 100).toFixed(2)}% p.a. · monthly rests · appointed day{" "}
              {interest.appointed_day}
            </p>
            {(interest.schedule || []).length > 0 && (
              <div className="mt-4 divide-y divide-surface-line border-t border-surface-line">
                {interest.schedule.slice(0, 5).map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 font-mono text-2xs tnum">
                    <span className="text-ink-faint">
                      {s.from} → {s.to}
                    </span>
                    <span className="text-ink-muted">
                      ₹{Number(s.opening_balance).toLocaleString("en-IN")}
                    </span>
                    <span className="text-jade-300">+₹{Number(s.interest_this_period).toFixed(2)}</span>
                  </div>
                ))}
                {interest.schedule.length > 5 ? (
                  <p className="py-1.5 text-2xs text-ink-faint">
                    +{interest.schedule.length - 5} further monthly rests
                  </p>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>

      {/* Timeline */}
      <div className="mt-8">
        <SectionHeader title="Timeline" />
        {!events ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-ink-muted">No recorded actions for this invoice yet.</p>
        ) : (
          <ol className="relative space-y-3.5 pl-4">
            <span className="absolute inset-y-1 left-0 w-px bg-surface-line" />
            {events.map((e) => {
              const meta = ACTION_META[e.action] || { label: e.action, tone: "neutral" };
              return (
                <li key={e.id} className="relative pl-3">
                  <span
                    className={cn(
                      "absolute -left-[4.5px] top-1.5 h-[7px] w-[7px] rounded-full ring-[3px] ring-surface-base",
                      TONE_DOT[meta.tone],
                    )}
                  />
                  <p className="text-[13px] text-ink-secondary">{meta.label}</p>
                  <p className="mt-0.5 font-mono text-2xs tnum text-ink-faint">
                    {e.ts}
                    {e.step !== "none" ? ` · step ${e.step}` : ""}
                    {e.razorpay_id ? ` · ${e.razorpay_id}` : ""}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <Divider className="mt-8" />
    </Drawer>
  );
}
