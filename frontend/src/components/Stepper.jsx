import React, { Children, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { DUR, EASE } from "@/ui/motion";

/**
 * Adapted from React Bits Stepper — recoloured to DueNorth tokens, chrome
 * stripped (no card wrapper / aspect box), footer buttons use the shared
 * button language. Used for the multi-stage registration flow only.
 */
export default function Stepper({
  children,
  initialStep = 1,
  onStepChange = () => {},
  onFinalStepCompleted = () => {},
  backButtonText = "Back",
  nextButtonText = "Continue",
  completeText = "Finish",
  className = "",
  canAdvance = () => true,
}) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [direction, setDirection] = useState(0);
  const steps = Children.toArray(children);
  const total = steps.length;
  const isLast = currentStep === total;

  const go = (next) => {
    setCurrentStep(next);
    if (next > total) onFinalStepCompleted();
    else onStepChange(next);
  };
  const back = () => {
    if (currentStep > 1) {
      setDirection(-1);
      go(currentStep - 1);
    }
  };
  const next = () => {
    if (!canAdvance(currentStep)) return;
    setDirection(1);
    isLast ? go(total + 1) : go(currentStep + 1);
  };

  return (
    <div className={className}>
      <div className="flex w-full items-center">
        {steps.map((_, i) => {
          const n = i + 1;
          const status = currentStep === n ? "active" : currentStep < n ? "upcoming" : "done";
          return (
            <React.Fragment key={n}>
              <div className="relative flex items-center justify-center">
                <motion.div
                  initial={false}
                  animate={status}
                  variants={{
                    upcoming: { backgroundColor: "#213141", borderColor: "#2C3F53", color: "#6B7C8C" },
                    active: { backgroundColor: "rgba(52,211,153,0.14)", borderColor: "#34D399", color: "#34D399" },
                    done: { backgroundColor: "#34D399", borderColor: "#34D399", color: "#08281E" },
                  }}
                  transition={{ duration: DUR.sm }}
                  className="flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold"
                >
                  {status === "done" ? <Check /> : n}
                </motion.div>
              </div>
              {i < total - 1 && (
                <div className="relative mx-2 h-px flex-1 overflow-hidden bg-surface-line">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-jade-400"
                    initial={false}
                    animate={{ width: currentStep > n ? "100%" : "0%" }}
                    transition={{ duration: DUR.md, ease: EASE }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <StepBody currentStep={currentStep} direction={direction} total={total}>
        {steps[currentStep - 1]}
      </StepBody>

      {currentStep <= total && (
        <div className={`mt-7 flex ${currentStep > 1 ? "justify-between" : "justify-end"}`}>
          {currentStep > 1 && (
            <button
              type="button"
              onClick={back}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-faint transition-colors hover:text-ink-primary"
            >
              {backButtonText}
            </button>
          )}
          <button
            type="button"
            onClick={next}
            className="rounded-lg bg-jade-400 px-4 py-2 text-sm font-semibold text-jade-900 transition-colors hover:bg-jade-300 disabled:opacity-50"
            disabled={!canAdvance(currentStep)}
          >
            {isLast ? completeText : nextButtonText}
          </button>
        </div>
      )}
    </div>
  );
}

function StepBody({ currentStep, direction, total, children }) {
  const [h, setH] = useState(0);
  const done = currentStep > total;
  return (
    <motion.div
      className="relative overflow-hidden"
      animate={{ height: done ? 0 : h }}
      transition={{ type: "spring", duration: DUR.md, bounce: 0 }}
    >
      <AnimatePresence initial={false} mode="sync" custom={direction}>
        {!done && (
          <Slide key={currentStep} direction={direction} onHeight={setH}>
            {children}
          </Slide>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Slide({ children, direction, onHeight }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (ref.current) onHeight(ref.current.offsetHeight);
  }, [children, onHeight]);
  return (
    <motion.div
      ref={ref}
      custom={direction}
      variants={{
        enter: (d) => ({ x: d >= 0 ? "12%" : "-12%", opacity: 0 }),
        center: { x: "0%", opacity: 1 },
        exit: (d) => ({ x: d >= 0 ? "-8%" : "8%", opacity: 0 }),
      }}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: DUR.md, ease: EASE }}
      className="absolute inset-x-0 top-0 pt-7"
    >
      {children}
    </motion.div>
  );
}

export function Step({ children }) {
  return <div>{children}</div>;
}

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}
