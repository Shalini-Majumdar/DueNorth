import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { api } from "../api/client";
import EmptyState from "../components/ui/EmptyState";
import { useApi } from "../hooks/useApi";

function FaqItem({ item, open, onToggle }) {
  return (
    <div className="border-b border-sage-200">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-4 text-left transition-colors hover:text-mint-400"
      >
        <span className="text-sm font-medium text-night-800">{item.question}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-sage-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <p className="pb-4 text-sm leading-relaxed text-sage-400">{item.answer}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default function FAQPage() {
  const { data, loading, error } = useApi(() => api.getFaq(), []);
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (i) =>
        i.question.toLowerCase().includes(q) || i.answer.toLowerCase().includes(q),
    );
  }, [data, query]);

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((i) => {
      if (!map.has(i.section)) map.set(i.section, []);
      map.get(i.section).push(i);
    });
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="max-w-3xl">
      <h2 className="mb-4 text-lg font-semibold text-night-800">
        Frequently Asked Questions
      </h2>

      <div className="relative mb-6">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sage-400"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions…"
          className="w-full rounded-lg border border-sage-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-mint-300 focus:ring-2 focus:ring-mint-100"
        />
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-sage-100" />
          ))}
        </div>
      ) : error ? (
        <EmptyState title="Could not load the FAQ" subtitle={String(error)} />
      ) : grouped.length === 0 ? (
        <EmptyState icon={Search} title="No matching questions" />
      ) : (
        grouped.map(([section, items]) => (
          <div key={section} className="mb-8">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-mint-500">
              {section}
            </h3>
            {items.map((item) => {
              const key = section + "::" + item.question;
              return (
                <FaqItem
                  key={key}
                  item={item}
                  open={openKey === key}
                  onToggle={() => setOpenKey((k) => (k === key ? null : key))}
                />
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
