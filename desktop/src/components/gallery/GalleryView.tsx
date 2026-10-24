import { useMemo, useRef } from "react";
import { motion } from "motion/react";
import { Images } from "lucide-react";
import { appear } from "@/lib/appear";
import { formatMonthRu } from "@/lib/dates";
import { Button } from "@/components/ui/Button";
import { EventCard } from "./EventCard";
import { DateScrubber } from "./DateScrubber";
import { EMPTY_FILTER, isFilterActive, matchesFilter, type EventFilter } from "@/lib/filter";
import type { TimelineEvent } from "@/db/queries/events";

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const byDateDesc = (a: TimelineEvent, b: TimelineEvent) =>
  a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id;

type MonthGroup = {
  key: string;
  label: string;
  events: TimelineEvent[];
};

function buildGroups(events: TimelineEvent[], filter: EventFilter): MonthGroup[] {
  const filterOn = isFilterActive(filter);
  const evMap = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    if (filterOn && !matchesFilter(e, filter)) continue;
    const key = e.date.slice(0, 7);
    const bucket = evMap.get(key);
    if (bucket) bucket.push(e);
    else evMap.set(key, [e]);
  }
  return [...evMap.keys()]
    .sort((a, b) => (a < b ? 1 : -1))
    .map((key) => {
      const evs = evMap.get(key)!.sort(byDateDesc);
      return { key, label: capitalize(formatMonthRu(evs[0].date)), events: evs };
    });
}

export function GalleryView({
  events,
  filter = EMPTY_FILTER,
  onFilterChange,
  onEventClick,
}: {
  events: TimelineEvent[];
  filter?: EventFilter;
  onFilterChange?: (filter: EventFilter) => void;
  onEventClick: (event: TimelineEvent) => void;
}) {
  const groups = useMemo(() => buildGroups(events, filter), [events, filter]);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (groups.length === 0) {
    const filterOn = isFilterActive(filter);
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-5 px-6 text-center">
        <span
          className="grid h-20 w-20 place-items-center rounded-full"
          style={{ background: "var(--ds-surface-2)", color: "var(--ds-accent-ink)" }}
        >
          <Images size={36} strokeWidth={1.5} />
        </span>
        <p className="max-w-sm text-[15px] leading-relaxed text-muted">
          {filterOn
            ? "Ничего не нашлось по фильтру. Попробуйте смягчить условия."
            : "Пока нет событий. Добавьте первое — и здесь появятся карточки с фото."}
        </p>
        {filterOn && onFilterChange && (
          <Button variant="secondary" onClick={() => onFilterChange(EMPTY_FILTER)}>
            Сбросить фильтры
          </Button>
        )}
      </div>
    );
  }

  let seen = 0;
  const starts = groups.map((g) => {
    const s = seen;
    seen += g.events.length;
    return s;
  });

  return (
    <div className="relative h-full w-full">
      <div
        ref={scrollRef}
        className="h-full w-full overflow-y-auto px-6 py-16 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="mx-auto max-w-6xl">
          {groups.map((group, gi) => (
            <section key={group.key} data-scrubber-key={group.key} className="mb-12">
              <div className="sticky top-0 z-30 mb-4 flex justify-center">
                <h2
                  className="m-0 inline-flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-muted backdrop-blur"
                  style={{ boxShadow: "var(--ds-shadow-1)" }}
                >
                  {group.label}
                  <span
                    className="inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium text-app-text"
                    style={{ background: "var(--ds-surface-3)" }}
                  >
                    {group.events.length}
                  </span>
                </h2>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
                {group.events.map((event, i) => (
                  <motion.div key={event.id} {...appear(starts[gi] + i)} className="grid">
                    <EventCard event={event} highlight={gi === 0 && i === 0} onClick={onEventClick} />
                  </motion.div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <DateScrubber scrollRef={scrollRef} groups={groups} />
    </div>
  );
}
