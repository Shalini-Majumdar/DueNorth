import { motion } from "motion/react";
import { Play, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { api } from "@/api/client";
import { useToast } from "@/components/layout/Toast";
import { Button } from "@/ui";

/**
 * The operational action strip. "Run agent" is the moment the system visibly
 * works, so it reports what changed rather than just succeeding quietly.
 */
export default function CommandBar({ onAgentRun, compact = false }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [running, setRunning] = useState(false);

  const runAgent = async () => {
    setRunning(true);
    try {
      const s = await api.runDunning();
      toast(
        `${s.dunning_sent} reminders sent · ${s.held_for_human} held for review · ${s.escalated_msefc} MSEFC notices prepared`,
        "success",
      );
      onAgentRun?.(s);
    } catch (e) {
      toast(e?.response?.data?.detail || "Agent run failed", "error");
    } finally {
      setRunning(false);
    }
  };

  const upload = async (file) => {
    if (!file) return;
    try {
      const r = await api.ingest(file);
      toast(
        `${r.filename} — ${r.valid_rows} rows accepted, ${r.quarantined_rows} quarantined`,
        r.quarantined_rows > 0 ? "warn" : "success",
      );
    } catch (e) {
      toast(e?.response?.data?.detail || "Import failed", "error");
    }
  };

  return (
    <div className="flex items-center gap-2">
      {!compact && (
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload />
          Import ledger
        </Button>
      )}
      <Button size="sm" onClick={runAgent} disabled={running} className="relative">
        {running ? (
          <motion.span
            className="h-3.5 w-3.5 rounded-full border-2 border-jade-900/30 border-t-jade-900"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
          />
        ) : (
          <Play />
        )}
        {running ? "Working…" : "Run agent"}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
