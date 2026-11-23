"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { clearHistory, readHistory, type HistoryEntry } from "@/lib/history";
import { formatRelativeTime } from "@/lib/format";
import { ArrowDownIcon, TrashIcon } from "@/components/icons";

export default function HistoriquePage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setEntries(readHistory());
  }, []);

  const handleClear = () => {
    clearHistory();
    setEntries([]);
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pb-16 pt-14">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Historique</h1>
          <p className="mt-1 text-sm text-muted">Conserve uniquement sur ton appareil, jamais sur nos serveurs.</p>
        </div>
        {entries.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-muted transition-colors hover:text-ink"
          >
            <TrashIcon className="h-4 w-4" />
            Vider
          </button>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {entries.length === 0 && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-dashed border-line px-6 py-12 text-center text-sm text-muted">
            Rien ici pour le moment. Ton premier téléchargement apparaîtra sur cette page.
          </motion.p>
        )}

        <motion.ul initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-3">
          <AnimatePresence initial={false}>
            {entries.map((entry) => (
              <motion.li
                key={entry.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-4 rounded-2xl border border-line bg-card p-3"
              >
                <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-line">
                  {entry.thumbnail && <img src={entry.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{entry.title}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {entry.format} · {formatRelativeTime(entry.at)}
                  </p>
                </div>
                <a
                  href={`/?url=${encodeURIComponent(entry.url)}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:text-accent"
                  aria-label="Reprendre ce téléchargement"
                >
                  <ArrowDownIcon className="h-4 w-4" />
                </a>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      </div>
    </div>
  );
}
