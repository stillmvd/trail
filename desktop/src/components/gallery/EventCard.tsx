import { createElement } from "react";
import { ArrowUpRight, CalendarClock } from "lucide-react";
import { formatFullRu, formatDayMonthRu } from "@/lib/dates";
import { eventAccent } from "@/lib/accent";
import { resolveIconOrNull } from "@/lib/icons";
import { isFuture } from "@/lib/duration";
import { CoverPlaceholder } from "@/components/ui/CoverPlaceholder";
import type { TimelineEvent } from "@/db/queries/events";
import { MediaImg } from "@/components/ui/MediaImg";

const ELEVATION_1 = "var(--ds-shadow-1)";
const ELEVATION_2 = "var(--ds-shadow-2)";

export function EventCard({
  event,
  highlight,
  onClick,
}: {
  event: TimelineEvent;
  highlight?: boolean;
  onClick: (event: TimelineEvent) => void;
}) {
  const accent = eventAccent(event);
  const Icon = resolveIconOrNull(event.category_icon);
  const dateLabel = event.end_date
    ? `${formatDayMonthRu(event.date)} ↔ ${formatFullRu(event.end_date)}`
    : formatFullRu(event.date);
  const future = isFuture(event.date);

  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-4xl text-left transition-[box-shadow,scale] duration-200 ease-[var(--rg-ease)] active:scale-[0.96] ${
        highlight ? "bg-amber text-ink" : "bg-surface-1 text-app-text"
      }`}
      style={{ boxShadow: ELEVATION_1 }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = ELEVATION_2)}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = ELEVATION_1)}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 bg-app-text opacity-0 transition-opacity duration-200 group-hover:opacity-[0.06]"
      />

      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {event.cover ? (
          <MediaImg
            path={event.cover}
            className="h-full w-full object-cover"
            style={{ opacity: future ? 0.6 : undefined }}
          />
        ) : (
          <CoverPlaceholder
            fill={accent.fill}
            icon={event.category_icon}
            dimmed={future}
            onAccent={highlight}
          />
        )}

        {event.category_name && (
          <span
            className="absolute left-3 top-3 z-10 inline-flex max-w-[75%] items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ background: accent.fill, color: accent.onFill }}
            title={event.category_name}
          >
            {Icon && createElement(Icon, { size: 12 })}
            <span className="truncate">{event.category_name}</span>
          </span>
        )}

        {future && (
          <span
            className="absolute bottom-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-app-text backdrop-blur"
            style={{
              background: "color-mix(in srgb, var(--rg-surface) 85%, transparent)",
            }}
          >
            <CalendarClock size={12} strokeWidth={1.75} />
            Запланировано
          </span>
        )}

        <span
          aria-hidden
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] group-hover:scale-105"
          style={{
            background: highlight ? "var(--ds-on-accent)" : "var(--rg-bg)",
            color: highlight ? "var(--rg-amber)" : "var(--rg-text)",
          }}
        >
          <ArrowUpRight size={16} strokeWidth={2} />
        </span>
      </div>

      <div className="min-h-[3.9rem] p-4">
        <p className="line-clamp-2 text-[17px] font-bold leading-tight tracking-tight">
          {event.title}
        </p>
        <p className={`mt-1 text-sm ${highlight ? "opacity-60" : "text-muted"}`}>{dateLabel}</p>
      </div>
    </button>
  );
}
