import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { COLORS } from "../../utils/constants";
import { formatCurrency } from "../../utils/formatCurrency";

export default function LiftChart({ aiCurve = [], baseCurve = [] }) {
  const data = aiCurve.map((v, day) => ({
    day,
    ai: v,
    base: baseCurve[day] ?? 0,
  }));

  return (
    <div className="h-[380px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid stroke="#e8ede5" strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            tick={{ fill: COLORS.sage400, fontSize: 12 }}
            label={{ value: "Day", position: "insideBottom", offset: -4, fill: COLORS.sage400, fontSize: 12 }}
          />
          <YAxis
            tick={{ fill: COLORS.sage400, fontSize: 12 }}
            tickFormatter={(v) => new Intl.NumberFormat("en-IN", { notation: "compact" }).format(v)}
            width={70}
          />
          <Tooltip
            formatter={(v, name) => [
              formatCurrency(v),
              name === "ai" ? "AI Ranked" : "Oldest-First",
            ]}
            labelFormatter={(d) => `Day ${d}`}
            contentStyle={{ borderRadius: 8, border: "1px solid #d5ddd0", fontSize: 13 }}
          />
          <Legend
            verticalAlign="bottom"
            formatter={(name) => (name === "ai" ? "AI Ranked" : "Oldest-First")}
          />
          <Line
            type="monotone"
            dataKey="ai"
            stroke={COLORS.mint300}
            strokeWidth={2.5}
            dot={false}
            animationDuration={2000}
          />
          <Line
            type="monotone"
            dataKey="base"
            stroke={COLORS.blush300}
            strokeWidth={2.5}
            dot={false}
            animationDuration={2000}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
