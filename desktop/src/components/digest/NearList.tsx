import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import type { DigestEntry } from "@/db/queries/digests";
import { DigestRows } from "./DigestRows";

const SPRING = { type: "spring", bounce: 0, duration: 0.35 } as const;

export function NearList({ entries, onOpen }: { entries: DigestEntry[]; onOpen: (entry: DigestEntry) => void }) {
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;

  return (
    <section className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-full bg-surface-1 px-[18px] text-left text-[13px] font-semibold text-muted transition-[background-color,color,scale] duration-150 ease-[var(--rg-ease)] hover:bg-surface-2 hover:text-app-text active:scale-[0.96]"
      >
        Было близко: {entries.length}
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          className="ml-auto text-[var(--ds-text-faint)] transition-transform duration-200 ease-[var(--rg-ease)]"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={SPRING}
          >
            <DigestRows
              rows={entries.map((e) => ({ key: e.item_id, title: e.title, source: e.source, onOpen: () => onOpen(e) }))}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
