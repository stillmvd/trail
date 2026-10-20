import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import type { DigestEntry } from "@/db/queries/digests";

const SPRING = { type: "spring", bounce: 0, duration: 0.35 } as const;

export function NearList({ entries, onOpen }: { entries: DigestEntry[]; onOpen: (entry: DigestEntry) => void }) {
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-fit cursor-pointer items-center gap-1.5 rounded-full px-1 text-[13px] font-medium text-muted transition-[color,scale] duration-150 ease-[var(--rg-ease)] hover:text-app-text active:scale-[0.96]"
      >
        Было близко: {entries.length}
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          className="transition-transform duration-200 ease-[var(--rg-ease)]"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={SPRING}
            className="flex flex-col"
          >
            {entries.map((e) => (
              <li key={e.item_id}>
                <button
                  type="button"
                  onClick={() => onOpen(e)}
                  className="flex w-full min-w-0 cursor-pointer items-baseline gap-2 rounded-2xl px-3 py-2 text-left transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] hover:bg-surface-1 active:scale-[0.96]"
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] text-app-text">{e.title}</span>
                  <span className="shrink-0 text-[12.5px] text-[var(--ds-text-faint)]">{e.source}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </section>
  );
}
