import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Minus, Plus } from "lucide-react";

import { api } from "@/api/client";
import { useToast } from "@/components/layout/Toast";
import { useApi } from "@/hooks/useApi";
import {
  Button,
  ElasticSlider,
  Eyebrow,
  Field,
  Input,
  Money,
  PageHeader,
  Panel,
  SectionHeader,
  Skeleton,
} from "@/ui";

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function daysSince(iso) {
  return Math.max(0, Math.round((Date.now() - new Date(iso + "T00:00:00").getTime()) / 86400000));
}

export default function InterestPage() {
  const toast = useToast();
  const cfg = useApi(() => api.getConfig(), []);
  const [principal, setPrincipal] = useState(500000);
  const [dueDate, setDueDate] = useState(isoDaysAgo(120));
  const [days, setDays] = useState(120);
  const [result, setResult] = useState(null);
  const [pending, setPending] = useState(false);
  const timer = useRef(null);

  const principalText = useMemo(
    () => new Intl.NumberFormat("en-IN").format(Number(principal) || 0),
    [principal],
  );

  useEffect(() => {
    clearTimeout(timer.current);
    setPending(true);
    timer.current = setTimeout(() => {
      api
        .calcInterest({ principal: Number(principal) || 0, due_date: dueDate, days_overdue: Number(days) || 0 })
        .then(setResult)
        .catch(() => setResult({ error: true }))
        .finally(() => setPending(false));
    }, 240);
    return () => clearTimeout(timer.current);
  }, [principal, dueDate, days]);

  const onDue = (v) => {
    setDueDate(v);
    setDays(daysSince(v));
  };

  const generateNotice = async () => {
    try {
      const r = await api.prefillDemand({
        principal: Number(principal),
        due_date: dueDate,
        days_overdue: Number(days),
      });
      toast(`Draft notice prepared — ${r.status.replace(/_/g, " ").toLowerCase()}. Nothing has been filed.`, "success");
    } catch (e) {
      toast(e?.response?.data?.detail || "Could not prepare notice", "error");
    }
  };

  const bank = ((cfg.data?.bank_rate ?? 0.055) * 100).toFixed(2);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Interest calculator"
        subtitle="Section 16 compound interest with monthly rests, at three times the RBI Bank Rate."
      />

      <div className="grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Inputs */}
        <Panel className="h-fit p-5">
          <Field label="Principal">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-ink-faint">
                ₹
              </span>
              <Input
                inputMode="numeric"
                value={principalText}
                onChange={(e) => setPrincipal(e.target.value.replace(/[^\d]/g, ""))}
                className="pl-7 font-mono tnum"
              />
            </div>
          </Field>

          <Field label="Invoice due date" className="mt-4">
            <Input type="date" value={dueDate} onChange={(e) => onDue(e.target.value)} className="font-mono" />
          </Field>

          <Field label="Days overdue" className="mt-4">
            <Input
              type="number"
              min={0}
              max={1095}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="font-mono tnum"
            />
          </Field>

          <div className="mt-3">
            <ElasticSlider
              value={Math.min(Number(days) || 0, 365)}
              onChange={setDays}
              min={0}
              max={365}
              leftIcon={<Minus size={12} />}
              rightIcon={<Plus size={12} />}
            />
            <div className="flex justify-between px-1 text-2xs text-ink-faint">
              <span>0</span>
              <span>drag to explore</span>
              <span>365</span>
            </div>
          </div>

          <dl className="mt-6 space-y-2 border-t border-surface-line pt-4 text-2xs">
            <div className="flex justify-between">
              <dt className="text-ink-faint">RBI Bank Rate</dt>
              <dd className="font-mono tnum text-ink-muted">{bank}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-faint">Statutory multiple</dt>
              <dd className="font-mono tnum text-ink-muted">3×</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-faint">Effective rate</dt>
              <dd className="font-mono tnum text-jade-300">
                {result && !result.error ? (result.statutory_rate_pa * 100).toFixed(2) : "—"}% p.a.
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-faint">Rest frequency</dt>
              <dd className="text-ink-muted">Monthly</dd>
            </div>
          </dl>

          <p className="mt-4 border-l-2 border-amber-400/50 pl-3 text-2xs leading-relaxed text-ink-muted">
            Applies only to Micro and Small suppliers holding a valid Udyam registration at the time of supply.
          </p>
        </Panel>

        {/* Result + auditable trail */}
        <div>
          <SectionHeader title="Result" hint={pending ? "recalculating…" : undefined} />

          {!result ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-56" />
            </div>
          ) : result.error ? (
            <p className="text-sm text-ink-muted">Enter a valid principal and date to calculate.</p>
          ) : (
            <>
              <div className="grid gap-6 border-y border-surface-line py-6 sm:grid-cols-3">
                <div>
                  <Eyebrow>Principal</Eyebrow>
                  <div className="mt-2">
                    <Money amount={result.principal} size="xl" decimals />
                  </div>
                </div>
                <div>
                  <Eyebrow>Interest accrued</Eyebrow>
                  <div className="mt-2">
                    <Money amount={result.interest} tone="warn" size="xl" decimals animate />
                  </div>
                </div>
                <div>
                  <Eyebrow>Total due</Eyebrow>
                  <div className="mt-2">
                    <Money amount={result.total_due} tone="recovered" size="xl" decimals animate />
                  </div>
                </div>
              </div>

              <p className="mt-3 text-xs text-ink-muted">
                Interest runs from the appointed day{" "}
                <span className="font-mono tnum text-ink-secondary">{result.appointed_day}</span> to{" "}
                <span className="font-mono tnum text-ink-secondary">{result.end_date}</span> over{" "}
                <span className="font-mono tnum text-ink-secondary">{(result.schedule || []).length}</span>{" "}
                monthly rests.
              </p>

              {(result.schedule || []).length > 0 && (
                <div className="mt-7">
                  <SectionHeader title="Calculation trail" hint="each monthly rest, in order" />
                  <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 border-y border-surface-line py-2 text-2xs font-medium uppercase tracking-wider text-ink-faint">
                    <span>From</span>
                    <span>To</span>
                    <span className="text-right">Opening balance</span>
                    <span className="text-right">Interest</span>
                  </div>
                  <div className="max-h-[22rem] divide-y divide-surface-line overflow-y-auto">
                    {result.schedule.map((s, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 py-2 font-mono text-xs tnum"
                      >
                        <span className="text-ink-faint">{s.from}</span>
                        <span className="text-ink-faint">{s.to}</span>
                        <span className="text-right text-ink-muted">
                          ₹{Number(s.opening_balance).toLocaleString("en-IN")}
                        </span>
                        <span className="text-right text-jade-300">
                          +₹{Number(s.interest_this_period).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 border-t border-surface-edge py-2.5 font-mono text-xs tnum">
                    <span className="col-span-3 text-ink-muted">Total interest</span>
                    <span className="text-right font-semibold text-jade-300">
                      +₹{Number(result.interest).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-surface-line pt-5">
                <p className="max-w-md text-2xs leading-relaxed text-ink-faint">
                  An engineering calculation under MSMED Act 2006 ss.15–16 — not legal advice. Have a chartered
                  accountant review any notice before it is filed.
                </p>
                <Button variant="secondary" size="sm" onClick={generateNotice}>
                  <FileText />
                  Prepare demand notice
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
