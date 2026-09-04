import { useInView, useMotionValue, useSpring } from "motion/react";
import { useCallback, useEffect, useRef } from "react";

/**
 * Adapted from React Bits CountUp — adds a `format(value) => string` prop so
 * DueNorth can render Indian-grouped rupee amounts, and respects
 * prefers-reduced-motion.
 */
export default function CountUp({
  to,
  from = 0,
  direction = "up",
  delay = 0,
  duration = 1.1,
  className = "",
  startWhen = true,
  format,
  separator = ",",
  onStart,
  onEnd,
}) {
  const ref = useRef(null);
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const motionValue = useMotionValue(direction === "down" ? to : from);
  const damping = 26 + 30 * (1 / duration);
  const stiffness = 90 * (1 / duration);
  const springValue = useSpring(motionValue, { damping, stiffness });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  const decimals = (n) => {
    const s = String(n);
    return s.includes(".") && parseInt(s.split(".")[1], 10) !== 0
      ? s.split(".")[1].length
      : 0;
  };
  const maxDecimals = Math.max(decimals(from), decimals(to));

  const formatValue = useCallback(
    (v) => {
      if (typeof format === "function") return format(v);
      const opts = {
        useGrouping: !!separator,
        minimumFractionDigits: maxDecimals,
        maximumFractionDigits: maxDecimals,
      };
      const s = Intl.NumberFormat("en-US", opts).format(v);
      return separator ? s.replace(/,/g, separator) : s;
    },
    [format, maxDecimals, separator],
  );

  useEffect(() => {
    if (ref.current) ref.current.textContent = formatValue(reduce ? to : from);
  }, [from, to, formatValue, reduce]);

  useEffect(() => {
    if (!isInView || !startWhen) return;
    if (reduce) {
      if (ref.current) ref.current.textContent = formatValue(to);
      onStart?.();
      onEnd?.();
      return;
    }
    onStart?.();
    const t1 = setTimeout(() => motionValue.set(direction === "down" ? from : to), delay * 1000);
    const t2 = setTimeout(() => onEnd?.(), delay * 1000 + duration * 1000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isInView, startWhen, reduce, motionValue, direction, from, to, delay, duration, formatValue, onStart, onEnd]);

  useEffect(() => {
    const unsub = springValue.on("change", (v) => {
      if (ref.current) ref.current.textContent = formatValue(v);
    });
    return () => unsub();
  }, [springValue, formatValue]);

  return <span className={className} ref={ref} />;
}
