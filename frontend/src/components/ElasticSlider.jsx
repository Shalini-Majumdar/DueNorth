import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";

const MAX_OVERFLOW = 40;

/**
 * Adapted from React Bits ElasticSlider — made controlled (`value` + `onChange`),
 * recoloured to the DueNorth track/fill tokens, full-width, and the built-in
 * numeric label removed (the caller renders its own, usually a CountUp).
 */
export default function ElasticSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  className = "",
  leftIcon = null,
  rightIcon = null,
}) {
  const sliderRef = useRef(null);
  const [region, setRegion] = useState("middle");
  const clientX = useMotionValue(0);
  const overflow = useMotionValue(0);
  const scale = useMotionValue(1);

  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;

  useMotionValueEvent(clientX, "change", (latest) => {
    if (!sliderRef.current) return;
    const { left, right } = sliderRef.current.getBoundingClientRect();
    let next;
    if (latest < left) {
      setRegion("left");
      next = left - latest;
    } else if (latest > right) {
      setRegion("right");
      next = latest - right;
    } else {
      setRegion("middle");
      next = 0;
    }
    overflow.jump(decay(next, MAX_OVERFLOW));
  });

  const commit = (clientXPos) => {
    if (!sliderRef.current) return;
    const { left, width } = sliderRef.current.getBoundingClientRect();
    let next = min + ((clientXPos - left) / width) * (max - min);
    next = Math.round(next / step) * step;
    next = Math.min(Math.max(next, min), max);
    onChange?.(next);
    clientX.jump(clientXPos);
  };

  const onPointerMove = (e) => {
    if (e.buttons > 0) commit(e.clientX);
  };
  const onPointerDown = (e) => {
    commit(e.clientX);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerUp = () => animate(overflow, 0, { type: "spring", bounce: 0.5 });

  return (
    <motion.div
      onHoverStart={() => animate(scale, 1.08)}
      onHoverEnd={() => animate(scale, 1)}
      onTouchStart={() => animate(scale, 1.08)}
      onTouchEnd={() => animate(scale, 1)}
      style={{ scale, opacity: useTransform(scale, [1, 1.08], [0.85, 1]) }}
      className={`flex w-full touch-none select-none items-center gap-3 ${className}`}
    >
      {leftIcon ? <span className="text-ink-faint">{leftIcon}</span> : null}
      <div
        ref={sliderRef}
        className="relative flex grow cursor-grab items-center py-3 active:cursor-grabbing"
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onPointerUp}
      >
        <motion.div
          style={{
            scaleX: useTransform(() => {
              if (!sliderRef.current) return 1;
              const { width } = sliderRef.current.getBoundingClientRect();
              return 1 + overflow.get() / width;
            }),
            scaleY: useTransform(overflow, [0, MAX_OVERFLOW], [1, 0.75]),
            transformOrigin: useTransform(() => {
              if (!sliderRef.current) return "center";
              const { left, width } = sliderRef.current.getBoundingClientRect();
              return clientX.get() < left + width / 2 ? "right" : "left";
            }),
            height: useTransform(scale, [1, 1.08], [6, 10]),
          }}
          className="flex grow"
        >
          <div className="relative h-full grow overflow-hidden rounded-full bg-surface-line">
            <div className="absolute h-full rounded-full bg-jade-400" style={{ width: `${pct}%` }} />
          </div>
        </motion.div>
        <div
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-jade-400 bg-surface-overlay shadow-sm"
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>
      {rightIcon ? <span className="text-ink-faint">{rightIcon}</span> : null}
    </motion.div>
  );
}

function decay(value, max) {
  if (max === 0) return 0;
  const entry = value / max;
  const sigmoid = 2 * (1 / (1 + Math.exp(-entry)) - 0.5);
  return sigmoid * max;
}
