import { createElement, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Search, X } from "lucide-react";
import { resolveIcon } from "@/lib/icons";
import { SIGNIFICANCE_LIST } from "@/lib/significance";
import { SignificanceIcon } from "@/components/ui/SignificanceIcon";
import { Button } from "@/components/ui/Button";
import { formatFullRu, formatDayMonthRu } from "@/lib/dates";
import { EMPTY_FILTER, isFilterActive, matchesFilter, type EventFilter } from "@/lib/filter";
import type { Significance } from "@/lib/constants";
import type { CategoryNode } from "@/db/queries/categories";
import type { TimelineEvent } from "@/db/queries/events";
import { useBack } from "@/lib/back";
import { tooltip } from "@/components/ui/Tooltip";

const MAX_RESULTS = 8;

export function SearchPanel({
  open,
  filter,
  categories,
  events,
  onFilterChange,
  onSelectResult,
  onClose,
}: {
  open: boolean;
  filter: EventFilter;
  categories: CategoryNode[];
  events: TimelineEvent[];
  onFilterChange: (filter: EventFilter) => void;
  onSelectResult: (event: TimelineEvent) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [allFor, setAllFor] = useState<string | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useBack(open, onClose);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  const flatCategories = categories.flatMap((c) => [c, ...c.children]);

  const toggleCategory = (id: number) => {
    const categoryIds = filter.categoryIds.includes(id)
      ? filter.categoryIds.filter((x) => x !== id)
      : [...filter.categoryIds, id];
    onFilterChange({ ...filter, categoryIds });
  };

  const toggleSignificance = (level: Significance) => {
    const significance = filter.significance.includes(level)
      ? filter.significance.filter((x) => x !== level)
      : [...filter.significance, level];
    onFilterChange({ ...filter, significance });
  };

  const active = isFilterActive(filter);

  const query = filter.query.trim();
  const matched = query ? events.filter((e) => matchesFilter(e, filter)) : [];
  matched.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
  const results = allFor === query ? matched : matched.slice(0, MAX_RESULTS);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="search-overlay"
          className="fixed inset-0 z-[70] flex justify-center bg-black/40 px-4 pt-24 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onMouseDown={onClose}
        >
          <motion.div
            className="h-fit w-full max-w-xl rounded-4xl bg-surface-1 p-5 shadow-2xl"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 rounded-full bg-surface-2 px-4">
              <Search size={18} strokeWidth={1.75} className="shrink-0 text-muted" />
              <input
                ref={inputRef}
                type="text"
                name="timeline-search"
                aria-label="Поиск событий"
                value={filter.query}
                onChange={(e) => onFilterChange({ ...filter, query: e.target.value })}
                placeholder="Поиск по названию и описанию…"
                className="h-11 flex-1 bg-transparent text-sm text-app-text outline-none placeholder:text-muted"
              />
              <button
                type="button"
                aria-label={filter.query ? "Очистить запрос" : "Закрыть"}
                {...tooltip(filter.query ? "Очистить запрос" : "Закрыть", "bottom")}
                onClick={() => {
                  if (filter.query) {
                    onFilterChange({ ...filter, query: "" });
                    inputRef.current?.focus();
                  } else {
                    onClose();
                  }
                }}
                className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-muted transition-[background-color,color,scale] duration-150 ease-[var(--rg-ease)] hover:bg-surface-3 hover:text-app-text active:scale-[0.96]"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            {query && (
              <div className="mt-3">
                {results.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-muted">
                    Ничего не найдено.
                  </div>
                ) : (
                  <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                    {results.map((event) => (
                      <li key={event.id}>
                        <button
                          type="button"
                          onClick={() => onSelectResult(event)}
                          className="flex w-full cursor-pointer items-center gap-2.5 rounded-full px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
                        >
                          {createElement(resolveIcon(event.category_icon), {
                            size: 16,
                            color: event.category_color ?? undefined,
                            className: "shrink-0",
                          })}
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-app-text">
                            {event.title}
                          </span>
                          <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs tabular-nums text-muted">
                            {event.end_date
                              ? `${formatDayMonthRu(event.date)} — ${formatFullRu(event.end_date)}`
                              : formatFullRu(event.date)}
                          </span>
                        </button>
                      </li>
                    ))}
                    {matched.length > results.length && (
                      <li>
                        <button
                          type="button"
                          onClick={() => setAllFor(query)}
                          className="w-full cursor-pointer rounded-full px-3 py-2 text-center text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-app-text"
                        >
                          Показать все ({matched.length})
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}

            <div className="mt-4">
              <div className="mb-2.5 inline-flex rounded-full bg-surface-2 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                Категории
              </div>
              <div className="flex flex-wrap gap-2">
                {flatCategories.map((cat) => {
                  const on = filter.categoryIds.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleCategory(cat.id)}
                      style={on ? { color: cat.color } : undefined}
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-[background-color,color,scale] duration-150 ease-[var(--rg-ease)] active:scale-[0.96] ${
                        on ? "bg-surface-3" : "bg-surface-2 text-muted hover:text-app-text"
                      }`}
                    >
                      {createElement(resolveIcon(cat.icon), { size: 14, color: cat.color })}
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2.5 inline-flex rounded-full bg-surface-2 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                Значимость
              </div>
              <div className="flex flex-wrap gap-2">
                {SIGNIFICANCE_LIST.map((meta) => {
                  const on = filter.significance.includes(meta.level);
                  return (
                    <button
                      key={meta.level}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleSignificance(meta.level)}
                      style={on ? { color: meta.color } : undefined}
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-[background-color,color,scale] duration-150 ease-[var(--rg-ease)] active:scale-[0.96] ${
                        on ? "bg-surface-3" : "bg-surface-2 text-muted hover:text-app-text"
                      }`}
                    >
                      <SignificanceIcon level={meta.level} size={14} />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {active && (
              <div className="mt-4 flex justify-end">
                <Button variant="secondary" onClick={() => onFilterChange(EMPTY_FILTER)}>
                  Сбросить фильтры
                </Button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
