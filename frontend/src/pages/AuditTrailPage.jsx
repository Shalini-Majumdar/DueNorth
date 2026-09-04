import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Search } from "lucide-react";

import { api } from "@/api/client";
import { useApi } from "@/hooks/useApi";
import {
  ACTION_META,
  ACTION_SHORT,
  AnimatedList,
  Button,
  DUR,
  EASE,
  EmptyState,
  Eyebrow,
  GradualBlur,
  Input,
  PageHeader,
  SkeletonRows,
  StatusBadge,
  Tabs,
  TONE_DOT,
  cn,
} from "@/ui";
import { AUDIT_ACTIONS } from "@/utils/constants";

const PAGE = 40;

function EventRow({ e, open, onToggle }) {
  const meta = ACTION_META[e.action] || { label: e.action, tone: "neutral" };
  return (
    <div className="relative pl-4">
      <span
        className={cn(
          "absolute -left-[4.5px] top-[15px] h-[7px] w-[7px] rounded-full ring-[3px] ring-canvas",
          TONE_DOT[meta.tone],
        )}
      />
      <button
        onClick={onToggle}
        className="focus-ring group flex w-full items-center gap-3 rounded-md py-2.5 pl-3 pr-2 text-left transition-colors hover:bg-surface-raised"
      >
        <span className="w-11 shrink-0 font-mono text-2xs tnum text-ink-faint">{e.ts?.slice(11, 16)}</span>
        <span className="text-[13px] text-ink-secondary group-hover:text-ink-primary">{meta.label}</span>
        <span className="font-mono text-2xs text-ink-faint">{e.invoice_id_masked}</span>
        {e.razorpay_id ? (
          <span className="ml-auto hidden font-mono text-2xs text-ink-faint sm:inline">{e.razorpay_id}</span>
        ) : null}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DUR.sm, ease: EASE }}
            className="overflow-hidden"
          >
            <dl className="ml-3 grid grid-cols-2 gap-x-6 gap-y-3 border-l border-surface-line py-3 pl-4 sm:grid-cols-4">
              <div>
                <Eyebrow>Recorded</Eyebrow>
                <dd className="mt-1 font-mono text-2xs tnum text-ink-secondary">{e.ts}</dd>
              </div>
              <div>
                <Eyebrow>Invoice</Eyebrow>
                <dd className="mt-1 font-mono text-2xs text-ink-secondary">{e.invoice_id_masked}</dd>
              </div>
              <div>
                <Eyebrow>Dunning step</Eyebrow>
                <dd className="mt-1 text-2xs text-ink-secondary">
                  {e.step && e.step !== "none" ? e.step : "—"}
                </dd>
              </div>
              <div>
                <Eyebrow>Category</Eyebrow>
                <dd className="mt-1">
                  <StatusBadge tone={meta.tone} label={meta.label} />
                </dd>
              </div>
              {e.razorpay_id ? (
                <div className="col-span-2 sm:col-span-4">
                  <Eyebrow>Razorpay reference</Eyebrow>
                  <dd className="mt-1 font-mono text-2xs text-ink-secondary">{e.razorpay_id}</dd>
                </div>
              ) : null}
            </dl>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default function AuditTrailPage() {
  const [invoiceId, setInvoiceId] = useState("");
  const [action, setAction] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [openId, setOpenId] = useState(null);

  const params = useMemo(() => {
    const p = {};
    if (invoiceId.trim()) p.invoice_id = invoiceId.trim();
    if (action) p.action = action;
    return p;
  }, [invoiceId, action]);

  const { data, loading, error } = useApi(() => api.getAuditLog(params), [params.invoice_id, params.action]);
  const rows = (data || []).slice(0, limit);

  // group by calendar day so timestamps stay readable
  const groups = useMemo(() => {
    const out = [];
    let day = null;
    rows.forEach((e) => {
      const d = e.ts?.slice(0, 10);
      if (d !== day) {
        day = d;
        out.push({ day: d, events: [] });
      }
      out[out.length - 1].events.push(e);
    });
    return out;
  }, [rows]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Activity"
        subtitle="Every action DueNorth has taken, in order, with the invoice and payment reference."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <Input
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
            placeholder="Filter by invoice id"
            className="w-56 pl-9 font-mono"
          />
        </div>
        <Tabs
          value={action}
          onChange={setAction}
          options={[
            { value: "", label: "All" },
            ...AUDIT_ACTIONS.map((a) => ({ value: a, label: ACTION_SHORT[a] || a })),
          ]}
        />
      </div>

      {loading ? (
        <SkeletonRows rows={10} />
      ) : error ? (
        <EmptyState icon={Search} title="Could not load activity" subtitle={String(error)} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching events"
          subtitle="Run the agent from Overview or Invoices to generate activity."
        />
      ) : (
        <div className="relative">
          {groups.map((g) => (
            <section key={g.day} className="mb-6">
              <div className="mb-1 flex items-center gap-3">
                <Eyebrow>{g.day}</Eyebrow>
                <span className="h-px flex-1 bg-surface-line" />
                <span className="font-mono text-2xs tnum text-ink-faint">{g.events.length}</span>
              </div>
              <div className="relative">
                <span className="absolute inset-y-2 left-0 w-px bg-surface-line" />
                <AnimatedList
                  items={g.events}
                  getKey={(e) => e.id}
                  gap="gap-0"
                  renderItem={(e) => (
                    <EventRow
                      e={e}
                      open={openId === e.id}
                      onToggle={() => setOpenId((k) => (k === e.id ? null : e.id))}
                    />
                  )}
                />
              </div>
            </section>
          ))}
          <GradualBlur position="bottom" height="3rem" strength={1.4} divCount={4} opacity={0.9} />
        </div>
      )}

      {data && data.length > limit && (
        <Button variant="outline" size="sm" className="mt-2" onClick={() => setLimit((l) => l + PAGE)}>
          Load {Math.min(PAGE, data.length - limit)} more
        </Button>
      )}
    </div>
  );
}
