import { useMemo } from "react";
import { motion } from "motion/react";
import { Target } from "lucide-react";
import { appear } from "@/lib/appear";
import { TrackingCard } from "./TrackingCard";
import { useTodayISO } from "./clock";
import type { TimelineEvent } from "@/db/queries/events";

// Сортировка по близости к сегодня: прошлое — недавнее сверху, будущее — ближайшее сверху.
const byDateDesc = (a: TimelineEvent, b: TimelineEvent) =>
  a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id;
const byDateAsc = (a: TimelineEvent, b: TimelineEvent) =>
  a.date > b.date ? 1 : a.date < b.date ? -1 : a.id - b.id;

function Section({
  title,
  events,
  variant,
  showHeader,
  accentFirst,
  from = 0,
  onEventClick,
}: {
  title: string;
  events: TimelineEvent[];
  variant: "past" | "future";
  showHeader: boolean;
  accentFirst?: boolean;
  from?: number;
  onEventClick: (event: TimelineEvent) => void;
}) {
  return (
    <section>
      {showHeader && (
        <div className="sticky top-0 z-30 mb-4 flex justify-center">
          <h2
            className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-muted backdrop-blur"
            style={{ boxShadow: "var(--ds-shadow-1)" }}
          >
            {title}
            <span
              className="inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium text-app-text"
              style={{ background: "var(--ds-surface-3)" }}
            >
              {events.length}
            </span>
          </h2>
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(364px,1fr))] gap-5">
        {events.map((event, i) => (
          <motion.div key={event.id} {...appear(from + i)} className="grid">
            <TrackingCard
              event={event}
              variant={variant}
              highlight={accentFirst && i === 0}
              onClick={onEventClick}
            />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export function TrackingView({
  events,
  onEventClick,
}: {
  events: TimelineEvent[];
  onEventClick: (event: TimelineEvent) => void;
}) {
  // Реактивный «сегодня»: в полночь наступившее напоминание само уезжает в «Уже прошло».
  const today = useTodayISO();
  const { past, future } = useMemo(() => {
    const tracked = events.filter((e) => e.track === 1);
    return {
      past: tracked.filter((e) => e.date <= today).sort(byDateDesc),
      future: tracked.filter((e) => e.date > today).sort(byDateAsc),
    };
  }, [events, today]);

  if (past.length === 0 && future.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-5 px-6 text-center">
        <span
          className="grid h-20 w-20 place-items-center rounded-full"
          style={{ background: "var(--ds-surface-2)", color: "var(--ds-accent-ink)" }}
        >
          <Target size={36} strokeWidth={1.5} />
        </span>
        <p className="max-w-sm text-[15px] leading-relaxed text-muted">
          Нет отслеживаемых событий. Включите «Отслеживание» при создании или редактировании
          события — и оно появится здесь с отсчётом и годовщиной.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div className="h-full w-full overflow-y-auto px-6 py-20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto flex max-w-6xl flex-col gap-12">
          {future.length > 0 && (
            <Section
              title="Предстоящее"
              events={future}
              variant="future"
              showHeader={past.length > 0}
              accentFirst
              onEventClick={onEventClick}
            />
          )}
          {past.length > 0 && (
            <Section
              title="Уже прошло"
              events={past}
              variant="past"
              showHeader={future.length > 0}
              accentFirst={future.length === 0}
              from={future.length}
              onEventClick={onEventClick}
            />
          )}
        </div>
      </div>
    </div>
  );
}
