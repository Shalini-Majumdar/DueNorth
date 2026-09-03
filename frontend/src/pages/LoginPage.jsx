import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, Mail, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import PasswordInput from "../components/ui/PasswordInput";
import { URN_REGEX } from "../utils/constants";

const UDYAM_STATUSES = ["Micro", "Small", "Medium", "Not Registered"];
const fade = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05 } }),
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [biz, setBiz] = useState("");
  const [status, setStatus] = useState("Micro");
  const [urn, setUrn] = useState("");
  const [result, setResult] = useState(null);

  const urnRequired = status === "Micro" || status === "Small";
  const urnValid = useMemo(() => URN_REGEX.test(urn.trim()), [urn]);

  const signIn = (e) => {
    e.preventDefault();
    if (!email) return;
    localStorage.setItem("duenorth_email", email);
    navigate("/dashboard");
  };

  const register = (e) => {
    e.preventDefault();
    const fullCover = urnRequired && urnValid;
    setResult(
      fullCover
        ? {
            tone: "full",
            title: "Full statutory cover",
            body: "You're eligible for Section 16 interest recovery and MSEFC escalation.",
          }
        : {
            tone: "reminders",
            title: "Reminders only",
            body: "Medium and unregistered suppliers can use dunning and payment links but are not covered under Chapter V of the MSMED Act.",
          },
    );
  };

  const finishRegister = () => {
    localStorage.setItem("duenorth_email", email || "founder@business.in");
    navigate("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md rounded-2xl border border-sage-200 bg-white p-8 shadow-sm"
      >
        <div className="text-center">
          <h1 className="font-mono text-2xl font-bold text-night-800">DueNorth</h1>
          <p className="mt-1 text-sm text-sage-400">
            AI-powered invoice collection for Indian MSMEs
          </p>
        </div>

        <form
          onSubmit={mode === "signin" ? signIn : register}
          className="mt-8 flex flex-col gap-4"
        >
          <motion.div variants={fade} initial="hidden" animate="show" custom={0}>
            <div className="relative">
              <Mail
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sage-400"
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.in"
                className="w-full rounded-lg border border-sage-300 bg-white py-2.5 pl-9 pr-3 text-sm text-night-800 outline-none transition-all duration-200 focus:border-mint-300 focus:ring-2 focus:ring-mint-100"
              />
            </div>
          </motion.div>

          <motion.div variants={fade} initial="hidden" animate="show" custom={1}>
            <PasswordInput value={password} onChange={setPassword} />
          </motion.div>

          <AnimatePresence>
            {mode === "register" ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-col gap-4 overflow-hidden"
              >
                <input
                  value={biz}
                  onChange={(e) => setBiz(e.target.value)}
                  placeholder="Business name"
                  className="w-full rounded-lg border border-sage-300 bg-white px-3 py-2.5 text-sm text-night-800 outline-none focus:border-mint-300 focus:ring-2 focus:ring-mint-100"
                />
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-lg border border-sage-300 bg-white px-3 py-2.5 text-sm text-night-800 outline-none focus:border-mint-300 focus:ring-2 focus:ring-mint-100"
                >
                  {UDYAM_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>

                <div>
                  <div className="relative">
                    <input
                      value={urn}
                      disabled={!urnRequired}
                      onChange={(e) => setUrn(e.target.value.toUpperCase())}
                      placeholder="UDYAM-MH-12-0001234"
                      className="w-full rounded-lg border border-sage-300 bg-white px-3 py-2.5 pr-9 font-mono text-sm text-night-800 outline-none focus:border-mint-300 focus:ring-2 focus:ring-mint-100 disabled:bg-sage-100 disabled:text-sage-400"
                    />
                    {urnRequired && urn ? (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2">
                        {urnValid ? (
                          <CheckCircle size={16} className="text-mint-400" />
                        ) : (
                          <XCircle size={16} className="text-blush-400" />
                        )}
                      </span>
                    ) : null}
                  </div>
                  {!urnRequired ? (
                    <p className="mt-1 text-xs text-sage-400">
                      Udyam number not required for your category
                    </p>
                  ) : null}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <motion.button
            variants={fade}
            initial="hidden"
            animate="show"
            custom={2}
            type="submit"
            className="mt-2 rounded-lg bg-mint-300 px-4 py-2.5 text-sm font-semibold text-night-800 transition-colors hover:bg-mint-400"
          >
            {mode === "signin" ? "Sign In" : "Register"}
          </motion.button>
        </form>

        <button
          onClick={() => {
            setMode((m) => (m === "signin" ? "register" : "signin"));
            setResult(null);
          }}
          className="mt-4 w-full text-center text-sm text-sage-400 transition-colors hover:text-mint-400 hover:underline"
        >
          {mode === "signin" ? "New here? Register your business" : "Have an account? Sign in"}
        </button>

        <AnimatePresence>
          {result ? (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className={`mt-6 rounded-xl border-2 p-4 ${
                result.tone === "full"
                  ? "border-mint-300 bg-mint-50"
                  : "border-sage-300 bg-sage-100"
              }`}
            >
              <p className="text-sm font-semibold text-night-800">{result.title}</p>
              <p className="mt-1 text-sm text-night-800">{result.body}</p>
              <button
                onClick={finishRegister}
                className="mt-3 rounded-md bg-night-800 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-night-700"
              >
                Continue to dashboard
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
