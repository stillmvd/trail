import { AnimatePresence, motion } from "motion/react";
import { ListFilter, X } from "lucide-react";
import { isFilterActive, type EventFilter } from "@/lib/filter";
import { tooltip } from "@/components/ui/Tooltip";

const plural = (n: number) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "фильтр";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "фильтра";
  return "фильтров";
};

export function FilterIndicator({
  filter,
  onOpen,
  onClear,
}: {
  filter: EventFilter;
  onOpen: () => void;
  onClear: () => void;
}) {
  const active = isFilterActive(filter);
  const query = filter.query.trim();
  const facets = filter.categoryIds.length + filter.significance.length;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="filter-indicator"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ type: "spring", duration: 0.35, bounce: 0 }}
          className="fixed right-6 top-[3.25rem] z-[60] flex items-center gap-1 rounded-full bg-amber py-1.5 pl-4 pr-1.5 text-ink shadow-lg"
        >
          <button
            type="button"
            onClick={onOpen}
            {...tooltip("Открыть поиск", "bottom")}
            className="flex min-w-0 cursor-pointer items-center gap-2 pr-1 text-[13px] font-semibold active:scale-[0.96]"
          >
            <ListFilter size={14} strokeWidth={2} className="shrink-0" />
            <span className="max-w-[22rem] truncate">
              {query ? `«${query}»` : `${facets} ${plural(facets)}`}
            </span>
            {query && facets > 0 && (
              <span className="shrink-0 opacity-60">
                · {facets} {plural(facets)}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onClear}
            aria-label="Сбросить фильтр"
            {...tooltip("Сбросить фильтр", "bottom")}
            className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-full transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] active:scale-[0.96]"
            style={{ background: "color-mix(in srgb, var(--ds-on-accent) 12%, transparent)" }}
          >
            <X size={15} strokeWidth={2} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
