import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Ban, ChevronDown } from "lucide-react";
import { FUSED } from "@/components/digest/DigestRows";
import { useQuery } from "@/lib/useQuery";
import { bumpDigestVersion, digestVersionStore } from "@/lib/digest/stores";
import { listBans, unbanDomain } from "@/db/queries/digestReactions";

const SPRING = { type: "spring", bounce: 0, duration: 0.35 } as const;

export function DigestBansPanel() {
  const version = digestVersionStore.use();
  const loadBans = useCallback(() => listBans(), [version]);
  const { data } = useQuery(loadBans);
  const [open, setOpen] = useState(false);
  const bans = data ?? [];
  const expanded = open && bans.length > 0;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        disabled={bans.length === 0}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={expanded}
        className="flex min-h-[52px] w-full min-w-0 cursor-pointer items-center gap-3 rounded-3xl bg-surface-1 px-4 py-2 text-left transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] enabled:hover:bg-surface-2 enabled:active:scale-[0.96] disabled:cursor-default"
      >
        <Ban size={16} strokeWidth={1.75} className="shrink-0 text-[var(--ds-text-faint)]" />
        <span className="flex min-w-0 flex-1 flex-col leading-[1.25]">
          <b className="truncate text-sm font-semibold text-app-text">Скрытые домены</b>
          <span className="truncate text-xs text-[var(--ds-text-faint)]">
            {bans.length ? bans.map((b) => b.domain).join(", ") : "нет — скрыть домен можно правой кнопкой по карточке"}
          </span>
        </span>
        {bans.length > 0 && (
          <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-muted tabular-nums">
            {bans.length}
            <ChevronDown
              size={16}
              strokeWidth={1.75}
              className="text-[var(--ds-text-faint)] transition-transform duration-200 ease-[var(--rg-ease)]"
              style={{ transform: expanded ? "rotate(180deg)" : undefined }}
            />
          </span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SPRING}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-0.5 pt-0.5">
              {bans.map((b) => (
                <div key={b.domain} className={`flex min-h-12 items-center gap-3 bg-surface-1 py-1.5 pr-2 pl-11 ${FUSED}`}>
                  <span className="min-w-0 flex-1 truncate text-sm text-app-text">{b.domain}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await unbanDomain(b.domain);
                      bumpDigestVersion();
                    }}
                    className="inline-flex h-9 shrink-0 cursor-pointer items-center rounded-full px-4 text-[13px] font-semibold text-muted shadow-[inset_0_0_0_1px_var(--rg-line)] transition-[color,scale] duration-150 ease-[var(--rg-ease)] hover:text-app-text active:scale-[0.96]"
                  >
                    Вернуть
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
