import { Play, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

import { api } from "../../api/client";
import { useApi } from "../../hooks/useApi";
import { formatPercent } from "../../utils/formatCurrency";
import { useToast } from "./Toast";

export default function Sidebar({ open, onClose, onDataChanged }) {
  const { data: config } = useApi(() => api.getConfig(), []);
  const toast = useToast();
  const [running, setRunning] = useState(false);
  const fileRef = useRef(null);

  const runAgent = async () => {
    setRunning(true);
    try {
      const s = await api.runDunning();
      toast(
        `Agent run: ${s.dunning_sent} reminders, ${s.held_for_human} held, ${s.escalated_msefc} MSEFC prefills`,
        "success",
      );
      onDataChanged?.();
    } catch (e) {
      toast(e?.response?.data?.detail || "Agent run failed", "error");
    } finally {
      setRunning(false);
    }
  };

  const upload = async (file) => {
    if (!file) return;
    try {
      const res = await api.ingest(file);
      toast(
        `${res.filename}: ${res.valid_rows} valid, ${res.quarantined_rows} quarantined`,
        res.quarantined_rows > 0 ? "info" : "success",
      );
    } catch (e) {
      toast(e?.response?.data?.detail || "Upload failed", "error");
    }
  };

  const bankRate = config?.bank_rate ?? 0.055;
  const statRate = config?.statutory_rate ?? bankRate * 3;

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-night-900/30 lg:hidden"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={`fixed left-0 top-14 z-40 h-[calc(100vh-3.5rem)] w-64 overflow-y-auto border-r border-sage-200 bg-white p-4 transition-transform duration-200 lg:sticky lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-3 flex items-center justify-between lg:hidden">
          <span className="text-sm font-semibold text-night-800">Menu</span>
          <button onClick={onClose} aria-label="Close">
            <X size={18} className="text-sage-400" />
          </button>
        </div>

        <div className="rounded-lg border-l-4 border-mint-300 bg-mint-50 p-4">
          <p className="text-sm font-semibold text-night-800">
            RBI Bank Rate: {formatPercent(bankRate * 100, 2)}
          </p>
          <p className="mt-1 text-sm text-night-800">
            Statutory Rate (3x): {formatPercent(statRate * 100, 2)}
          </p>
          <p className="mt-2 text-xs text-sage-400">
            As of {config?.as_of || "2026-08-05"} — RBI MPC 62nd meeting
          </p>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-sage-400">
            Quick actions
          </p>
          <button
            onClick={runAgent}
            disabled={running}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-mint-300 px-3 py-2 text-sm font-medium text-night-800 transition-colors hover:bg-mint-400 disabled:opacity-60"
          >
            <Play size={16} />
            {running ? "Running agent…" : "Run Agent"}
          </button>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-sage-400">
            Import invoices
          </p>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-sage-300 px-3 py-4 text-sm text-sage-400 transition-colors hover:border-mint-300 hover:text-mint-400"
          >
            <Upload size={16} />
            CSV / Excel
          </button>
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
      </aside>
    </>
  );
}
