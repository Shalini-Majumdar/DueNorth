import { useRef, useState } from "react";

/**
 * Adapted from React Bits SpotlightCard — surface styling is left entirely to
 * `className` so it inherits the DueNorth card system; only the cursor-tracked
 * radial highlight is provided here.
 */
export default function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(116, 205, 172, 0.10)",
}) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const onMove = (e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      onFocus={() => setOpacity(1)}
      onBlur={() => setOpacity(0)}
      className={`relative overflow-hidden ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-500 ease-out"
        style={{
          opacity,
          background: `radial-gradient(320px circle at ${pos.x}px ${pos.y}px, ${spotlightColor}, transparent 72%)`,
        }}
      />
      {children}
    </div>
  );
}
