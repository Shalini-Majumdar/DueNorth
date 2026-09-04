// Single source of truth for motion timing across DueNorth.
// Keep everything calm: short durations, one easing curve, gentle springs.

export const EASE = [0.22, 1, 0.36, 1]; // premium ease-out
export const EASE_IN_OUT = [0.65, 0, 0.35, 1];

export const DUR = {
  xs: 0.12,
  sm: 0.18,
  md: 0.28,
  lg: 0.44,
};

export const STAGGER = 0.035;

export const spring = { type: "spring", stiffness: 420, damping: 34, mass: 0.9 };
export const springSoft = { type: "spring", stiffness: 240, damping: 30 };

// Shared variants
export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: DUR.md, ease: EASE } },
  exit: { opacity: 0, y: 6, transition: { duration: DUR.sm } },
};

export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DUR.md, ease: EASE } },
  exit: { opacity: 0, transition: { duration: DUR.sm } },
};

export const stagger = (delayChildren = 0) => ({
  animate: { transition: { staggerChildren: STAGGER, delayChildren } },
});
