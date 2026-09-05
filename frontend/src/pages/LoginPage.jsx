import { motion } from "motion/react";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "@/api/client";
import BlurText from "@/components/BlurText";
import { Button, DUR, EASE, Eyebrow, Field, Input, PasswordInput, Step, Stepper } from "@/ui";
import { URN_REGEX } from "@/utils/constants";

const STATUSES = ["Micro", "Small", "Medium", "Not Registered"];

// The API speaks the engine's vocabulary; the form speaks the user's.
const STATUS_TO_API = {
  Micro: "Micro",
  Small: "Small",
  Medium: "Medium",
  "Not Registered": "not_registered",
};

function Mark() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 1.5 18 6v8l-8 4.5L2 14V6l8-4.5Z" stroke="#34D399" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M10 18.5V10l8-4" stroke="#34D399" strokeWidth="1.4" strokeLinejoin="round" opacity=".55" />
        <path d="M10 10 2 6" stroke="#34D399" strokeWidth="1.4" strokeLinejoin="round" opacity=".3" />
      </svg>
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink-primary">DueNorth</span>
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("signin");

  return (
    <div className="relative flex min-h-screen flex-col bg-canvas px-6 py-10">
      <Mark />

      <div className="flex flex-1 items-center justify-center py-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.lg, ease: EASE }}
          className="w-full max-w-[380px]"
        >
          <BlurText
            text="Recover what you are owed."
            animateBy="words"
            delay={70}
            stepDuration={0.3}
            animationFrom={{ filter: "blur(6px)", opacity: 0, y: 8 }}
            animationTo={[
              { filter: "blur(2px)", opacity: 0.65, y: 3 },
              { filter: "blur(0px)", opacity: 1, y: 0 },
            ]}
            className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink-primary"
          />
          <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
            Autonomous receivables recovery for Indian MSMEs — statutory interest, dunning and MSEFC filings,
            calculated exactly.
          </p>

          <div className="mt-8">
            {mode === "signin" ? (
              <SignIn onDone={() => navigate("/dashboard")} onRegister={() => setMode("register")} />
            ) : (
              <Register onDone={() => navigate("/dashboard")} onSignIn={() => setMode("signin")} />
            )}
          </div>
        </motion.div>
      </div>

      {/* grounding strip — brand through substance, not illustration */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: DUR.lg, delay: 0.35 }}
        className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-surface-line pt-5 text-2xs text-ink-faint"
      >
        <span>MSMED Act 2006 · ss.15–16</span>
        <span className="hidden h-2.5 w-px bg-surface-line sm:block" />
        <span>
          Interest at <span className="font-mono tnum text-ink-muted">3×</span> the RBI Bank Rate
        </span>
        <span className="hidden h-2.5 w-px bg-surface-line sm:block" />
        <span>MSEFC / Samadhaan ready</span>
        <span className="ml-auto hidden sm:block">Nothing is ever filed without your approval.</span>
      </motion.div>
    </div>
  );
}

function SignIn({ onDone, onRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!email) return;
    localStorage.setItem("duenorth_email", email);
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Work email">
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@business.in"
          className="h-10"
        />
      </Field>
      <Field label="Password">
        <PasswordInput value={password} onChange={setPassword} className="h-10" />
      </Field>
      <Button type="submit" size="lg" className="w-full">
        Sign in
        <ArrowRight />
      </Button>
      <button
        type="button"
        onClick={onRegister}
        className="focus-ring w-full rounded py-1 text-center text-[13px] text-ink-muted transition-colors hover:text-jade-300"
      >
        Register your business
      </button>
    </form>
  );
}

function Register({ onDone, onSignIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [biz, setBiz] = useState("");
  const [status, setStatus] = useState("Micro");
  const [urn, setUrn] = useState("");

  // Server verdict from POST /api/onboard — this, not the local regex, is what
  // decides the flow. The regex below is only inline feedback while typing.
  const [verdict, setVerdict] = useState(null);
  const [error, setError] = useState("");

  const urnRequired = status === "Micro" || status === "Small";
  const urnValid = useMemo(() => URN_REGEX.test(urn.trim()), [urn]);
  const fullCover = verdict?.statutory_eligible === true;

  const canAdvance = (step) => {
    if (step === 1) return email.length > 3;
    if (step === 2) return biz.length > 1 && (!urnRequired || urnValid);
    return true;
  };

  // Leaving step 2 runs the real Udyam gate (engines/udyam.onboard) on the
  // server. A malformed URN comes back 422 and blocks the transition.
  const beforeAdvance = async (step) => {
    if (step !== 2) return true;
    setError("");
    try {
      const result = await api.onboard({
        name: biz.trim(),
        udyam_status: STATUS_TO_API[status],
        udyam_number: urnRequired ? urn.trim() : null,
      });
      setVerdict(result);
      return true;
    } catch (err) {
      setVerdict(null);
      setError(
        err?.response?.data?.detail ||
          "Could not verify your Udyam registration. Check your connection and try again.",
      );
      return false;
    }
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <Eyebrow>Register your business</Eyebrow>
        <button
          onClick={onSignIn}
          className="focus-ring rounded text-2xs text-ink-muted transition-colors hover:text-jade-300"
        >
          Have an account?
        </button>
      </div>

      <Stepper
        canAdvance={canAdvance}
        beforeAdvance={beforeAdvance}
        completeText="Open dashboard"
        onFinalStepCompleted={() => {
          localStorage.setItem("duenorth_email", email || "founder@business.in");
          onDone();
        }}
      >
        <Step>
          <div className="space-y-4">
            <Field label="Work email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.in"
                className="h-10"
              />
            </Field>
            <Field label="Password">
              <PasswordInput value={password} onChange={setPassword} className="h-10" />
            </Field>
          </div>
        </Step>

        <Step>
          <div className="space-y-4">
            <Field label="Registered business name">
              <Input
                value={biz}
                onChange={(e) => setBiz(e.target.value)}
                placeholder="Widgets & Co"
                className="h-10"
              />
            </Field>
            <Field label="Udyam status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="focus-ring h-10 w-full appearance-none rounded-lg bg-surface-overlay px-3 text-sm text-ink-primary ring-1 ring-inset ring-surface-line hover:ring-surface-edge focus:ring-jade-400/50"
              >
                {STATUSES.map((s) => (
                  <option key={s} className="bg-surface-overlay">
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Udyam registration number"
              hint={!urnRequired ? "Not required for Medium or unregistered suppliers" : undefined}
            >
              <div className="relative">
                <Input
                  disabled={!urnRequired}
                  value={urn}
                  onChange={(e) => setUrn(e.target.value.toUpperCase())}
                  placeholder="UDYAM-MH-12-0001234"
                  className="h-10 pr-9 font-mono"
                />
                {urnRequired && urn ? (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {urnValid ? (
                      <CheckCircle2 size={15} className="text-jade-400" />
                    ) : (
                      <XCircle size={15} className="text-coral-400" />
                    )}
                  </span>
                ) : null}
              </div>
            </Field>
            {error ? (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DUR.sm }}
                role="alert"
                className="text-[13px] leading-relaxed text-coral-300"
              >
                {error}
              </motion.p>
            ) : null}
          </div>
        </Step>

        <Step>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.md, ease: EASE }}
            className={`rounded-xl p-4 ring-1 ring-inset ${
              fullCover ? "bg-jade-400/8 ring-jade-400/30" : "bg-steel-400/8 ring-steel-400/30"
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className={`text-sm font-semibold ${fullCover ? "text-jade-300" : "text-steel-300"}`}>
                {fullCover ? "Full statutory cover" : "Reminders only"}
              </p>
              {verdict ? (
                <span className="font-mono text-2xs uppercase tracking-[0.08em] text-ink-faint">
                  flow: {verdict.flow}
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">
              {verdict?.explanation ||
                "Medium and unregistered suppliers can use dunning and payment links, but Chapter V of the MSMED Act does not apply — no statutory interest and no MSEFC route."}
            </p>
            <p className="mt-3 border-t border-surface-line/60 pt-3 text-2xs leading-relaxed text-ink-faint">
              Verified against your Udyam registration by DueNorth&apos;s compliance engine.
            </p>
          </motion.div>
        </Step>
      </Stepper>
    </div>
  );
}
