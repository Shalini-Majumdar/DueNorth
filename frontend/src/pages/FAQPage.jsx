import { AnimatePresence, motion } from "motion/react";
import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { api } from "@/api/client";
import { useApi } from "@/hooks/useApi";
import { DUR, EASE, EmptyState, Eyebrow, Input, PageHeader, Skeleton, cn } from "@/ui";

function Item({ item, open, onToggle }) {
  return (
    <div className="border-b border-surface-line">
      <button
        onClick={onToggle}
        className="focus-ring group flex w-full items-start justify-between gap-6 rounded py-3.5 text-left"
      >
        <span
          className={cn(
            "text-sm font-medium transition-colors",
            open ? "text-jade-300" : "text-ink-primary group-hover:text-ink-secondary",
          )}
        >
          {item.question}
        </span>
        <Plus
          size={15}
          className={cn(
            "mt-0.5 shrink-0 text-ink-faint transition-transform duration-200",
            open && "rotate-45 text-jade-300",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DUR.sm, ease: EASE }}
            className="overflow-hidden"
          >
            <p className="max-w-2xl pb-4 pr-8 text-[13px] leading-relaxed text-ink-secondary">{item.answer}</p>
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

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = (data || []).filter(
      (i) => !q || i.question.toLowerCase().includes(q) || i.answer.toLowerCase().includes(q),
    );
    const map = new Map();
    rows.forEach((i) => {
      if (!map.has(i.section)) map.set(i.section, []);
      map.get(i.section).push(i);
    });
    return [...map.entries()];
  }, [data, query]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Help & FAQ"
        subtitle="Statutory interest, dunning and MSEFC escalation are governed by real law. These answers explain the rules DueNorth follows, so you can trust every figure it produces."
      />

      <div className="relative mb-9">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions…"
          className="h-10 pl-9"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : error ? (
        <EmptyState title="Could not load the FAQ" subtitle={String(error)} />
      ) : grouped.length === 0 ? (
        <EmptyState icon={Search} title="No matching questions" subtitle="Try a different term." />
      ) : (
        grouped.map(([section, items]) => (
          <section key={section} className="mb-10">
            <div className="mb-2 flex items-center gap-3">
              <Eyebrow>{section}</Eyebrow>
              <span className="h-px flex-1 bg-surface-line" />
            </div>
            <div className="border-t border-surface-line">
              {items.map((item) => {
                const key = section + "::" + item.question;
                return (
                  <Item
                    key={key}
                    item={item}
                    open={openKey === key}
                    onToggle={() => setOpenKey((k) => (k === key ? null : key))}
                  />
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
