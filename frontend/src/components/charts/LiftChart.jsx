import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency } from "@/utils/formatCurrency";

const AXIS = "#6B7C8C";
const LINE = "#2C3F53";

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const ai = payload.find((p) => p.dataKey === "ai")?.value ?? 0;
  const base = payload.find((p) => p.dataKey === "base")?.value ?? 0;
  const delta = ai - base;
  return (
    <div className="rounded-lg bg-surface-raised px-3 py-2.5 shadow-lift ring-1 ring-inset ring-surface-edge">
      <p className="text-2xs uppercase tracking-wider text-ink-faint">Day {label}</p>
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-xs text-ink-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-jade-400" /> AI-ranked
          </span>
          <span className="font-mono text-xs tnum text-ink-primary">{formatCurrency(ai)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-xs text-ink-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-steel-400" /> Oldest-first
          </span>
          <span className="font-mono text-xs tnum text-ink-muted">{formatCurrency(base)}</span>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-6 border-t border-surface-line pt-2">
        <span className="text-2xs uppercase tracking-wider text-ink-faint">Advantage</span>
        <span className="font-mono text-xs tnum text-jade-300">+{formatCurrency(delta)}</span>
      </div>
    </div>
  );
}

export default function LiftChart({ aiCurve = [], baseCurve = [], height = 320 }) {
  const data = aiCurve.map((v, day) => ({ day, ai: v, base: baseCurve[day] ?? 0 }));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="aiArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34D399" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#34D399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={LINE} vertical={false} />
          <XAxis
            dataKey="day"
            stroke={LINE}
            tick={{ fill: AXIS, fontSize: 11 }}
            tickLine={false}
            ticks={[0, 15, 30, 45, 60, 75, 90]}
          />
          <YAxis
            stroke={LINE}
            tick={{ fill: AXIS, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v) => new Intl.NumberFormat("en-IN", { notation: "compact" }).format(v)}
          />
          {[30, 60, 90].map((d) => (
            <ReferenceLine key={d} x={d} stroke={LINE} strokeDasharray="3 4" />
          ))}
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#3B5268" }} />
          <Area
            type="monotone"
            dataKey="base"
            stroke="#5B97C9"
            strokeWidth={1.75}
            fill="transparent"
            dot={false}
            activeDot={{ r: 3, fill: "#5B97C9", stroke: "#1A2837", strokeWidth: 2 }}
            animationDuration={1200}
          />
          <Area
            type="monotone"
            dataKey="ai"
            stroke="#34D399"
            strokeWidth={2.25}
            fill="url(#aiArea)"
            dot={false}
            activeDot={{ r: 3.5, fill: "#34D399", stroke: "#1A2837", strokeWidth: 2 }}
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
