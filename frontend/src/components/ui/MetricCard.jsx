import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

/**
 * Animated metric card. Counts value up from 0 on mount.
 * - label: small uppercase caption
 * - value: target number
 * - format: fn(number) -> string
 * - subtitle: optional line below
 * - accent: hex color for the 3px top border
 * - plain: if true, render `value` as-is (string) with no counter
 */
export default function MetricCard({
  label,
  value,
  format = (n) => String(Math.round(n)),
  subtitle,
  accent = "#74CDAC",
  plain = false,
}) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { duration: 1500, bounce: 0 });
  const text = useTransform(spring, (v) => format(v));

  useEffect(() => {
    if (!plain) mv.set(Number(value) || 0);
  }, [value, mv, plain]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderTop: `3px solid ${accent}` }}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-sage-400">
        {label}
      </p>
      {plain ? (
        <p className="mt-2 text-3xl font-bold text-night-800">{value}</p>
      ) : (
        <motion.p className="mt-2 text-3xl font-bold text-night-800">{text}</motion.p>
      )}
      {subtitle ? (
        <p className="mt-2 text-sm text-sage-400">{subtitle}</p>
      ) : null}
    </motion.div>
  );
}
