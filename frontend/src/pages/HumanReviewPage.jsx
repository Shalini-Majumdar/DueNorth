import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { api } from "@/api/client";
import { useToast } from "@/components/layout/Toast";
import { useApi } from "@/hooks/useApi";
import {
  AnimatedList,
  Button,
  EmptyState,
  Eyebrow,
  Money,
  PageHeader,
  Panel,
  REASON_META,
  SkeletonPanels,
  StatusBadge,
  Tabs,
  cn,
  sectorLabel,
} from "@/ui";

/* Each reason gets an explicit four-part brief. Recommendations are advisory —
   the wording never implies DueNorth has already acted. */
const BRIEF = {
  disputed: {
    stopped: "The buyer has formally disputed this invoice, so statutory pressure would be inappropriate.",
    stake: "Interest and MSEFC rights are preserved while the dispute is open, but the debt is unrecoverable until it clears.",
    advises: "Do not send a statutory notice. Resolve directly, or refer the dispute to MSEFC conciliation.",
    recommend: "escalate",
    recommendLabel: "Refer to conciliation",
  },
  Medium: {
    stopped: "This supplier is registered Medium — outside Chapter V of the MSMED Act.",
    stake: "No statutory interest and no MSEFC route. Only commercial reminders and payment links apply.",
    advises: "Keep the invoice on reminders. Do not attempt a statutory claim.",
    recommend: "hold",
    recommendLabel: "Keep on reminders",
  },
  above_threshold: {
    stopped: "The invoice value is above your human-in-the-loop threshold of ₹10,00,000.",
    stake: "A large single exposure. Automated collection on this buyer could affect the wider relationship.",
    advises: "Confirm the amount and the buyer relationship, then release it back to automated collection.",
    recommend: "approve",
    recommendLabel: "Release to automation",
  },
  msefc: {
    stopped: "45+ days past the appointed day with full statutory cover — this is MSEFC eligible.",
    stake: "Compound interest at 3× the RBI Bank Rate is accruing and is legally claimable.",
    advises: "Approve to prepare a Samadhaan demand notice for your review. Nothing is filed automatically.",
    recommend: "approve",
    recommendLabel: "Prepare notice",
  },
};

const ACTIONS = {
  approve: { label: "Approve", variant: "primary" },
  hold: { label: "Hold", variant: "outline" },
  escalate: { label: "Escalate", variant: "danger" },
};

const PAGE = 10;

function Brief({ label, children, className }) {
  return (
    <div className={cn("min-w-0", className)}>
      <Eyebrow>{label}</Eyebrow>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">{children}</p>
    </div>
  );
}

function Case({ item, context, onDecide }) {
  const [confirm, setConfirm] = useState(null);
  const meta = REASON_META[item.reason] || { label: item.reason, tone: "neutral" };
  const b = BRIEF[item.reason] || {
    stopped: "Automation paused for manual review.",
    stake: "Review the invoice before continuing.",
    advises: "Decide how to proceed.",
    recommend: "hold",
    recommendLabel: "Hold",
  };

  return (
    <Panel rail={meta.tone} className="pl-5 pr-5 pt-4 pb-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-mono text-[13px] text-ink-primary">{item.invoice_id_masked}</span>
        <StatusBadge tone={meta.tone} label={meta.label} title={meta.title} />
        {context ? (
          <span className="text-xs text-ink-faint">
            {sectorLabel(context.sector)} · {context.days_past_due}d overdue
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-4">
          {context ? <Money amount={context.amount} tone="risk" size="md" /> : null}
          <span className="font-mono text-2xs tnum text-ink-faint">{item.created_at?.slice(0, 16)}</span>
        </span>
      </div>

      <div className="mt-4 grid gap-4 border-t border-surface-line pt-4 md:grid-cols-3">
        <Brief label="Why automation stopped">{b.stopped}</Brief>
        <Brief label="What is at stake">{b.stake}</Brief>
        <Brief label="DueNorth advises">{b.advises}</Brief>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-surface-line pt-3.5">
        <Eyebrow className="mr-1">Your decision</Eyebrow>
        {confirm ? (
          <>
            <span className="text-[13px] text-ink-secondary">
              Confirm <span className="font-medium text-ink-primary">{ACTIONS[confirm].label.toLowerCase()}</span>?
            </span>
            <Button size="xs" variant="primary" onClick={() => onDecide(item.id, confirm)}>
              Confirm
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            {Object.entries(ACTIONS).map(([key, a]) => {
              const isRec = key === b.recommend;
              return (
                <Button
                  key={key}
                  size="xs"
                  variant={isRec ? "primary" : key === "escalate" ? "danger" : "outline"}
                  onClick={() => setConfirm(key)}
                >
                  {a.label}
                </Button>
              );
            })}
            <span className="ml-1 text-2xs text-ink-faint">
              Suggested: <span className="text-ink-muted">{b.recommendLabel}</span>
            </span>
          </>
        )}
      </div>
    </Panel>
  );
}

export default function HumanReviewPage() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(PAGE);
  const [filter, setFilter] = useState("all");
  const overdue = useApi(() => api.getOverdue(), []);

  const load = () => {
    setLoading(true);
    api
      .getHumanReview()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const context = useMemo(() => {
    const m = {};
    (overdue.data || []).forEach((r) => (m[r.invoice_id_masked] = r));
    return m;
  }, [overdue.data]);

  const decide = async (id, action) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    try {
      const r = await api.reviewAction(id, action);
      toast(`${r.invoice_id_masked} — ${r.status.replace(/_/g, " ").toLowerCase()}`, "success");
    } catch (e) {
      toast(e?.response?.data?.detail || "Action failed", "error");
      load();
    }
  };

  const pending = (items || []).filter((i) => i.status === "PENDING_HUMAN_APPROVAL");
  const counts = useMemo(() => {
    const c = { all: pending.length };
    Object.keys(REASON_META).forEach((k) => (c[k] = pending.filter((i) => i.reason === k).length));
    return c;
  }, [pending]);

  const filtered = filter === "all" ? pending : pending.filter((i) => i.reason === filter);
  const shown = filtered.slice(0, limit);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Human review"
        subtitle="Cases where DueNorth stopped and a person has to decide. Nothing here has been actioned."
        actions={
          pending.length ? (
            <span className="rounded-md bg-amber-400/10 px-2.5 py-1.5 text-2xs font-medium text-amber-300 ring-1 ring-inset ring-amber-400/25">
              <span className="font-mono tnum">{pending.length}</span> awaiting decision
            </span>
          ) : null
        }
      />

      {!loading && pending.length > 0 && (
        <Tabs
          className="mb-5"
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setLimit(PAGE);
          }}
          options={[
            { value: "all", label: "All", count: counts.all },
            ...Object.entries(REASON_META)
              .filter(([k]) => counts[k] > 0)
              .map(([k, m]) => ({ value: k, label: m.label, count: counts[k] })),
          ]}
        />
      )}

      {loading ? (
        <SkeletonPanels count={3} height="h-44" />
      ) : pending.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nothing needs you right now"
          subtitle="Every overdue invoice is being handled automatically within policy."
        />
      ) : (
        <>
          <AnimatedList
            items={shown}
            getKey={(i) => i.id}
            gap="gap-3"
            renderItem={(item) => (
              <Case item={item} context={context[item.invoice_id_masked]} onDecide={decide} />
            )}
          />
          {filtered.length > shown.length && (
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setLimit((l) => l + PAGE)}>
              Show {Math.min(PAGE, filtered.length - shown.length)} more
            </Button>
          )}
        </>
      )}
    </div>
  );
}
