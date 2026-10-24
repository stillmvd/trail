import { createElement } from "react";
import { ArrowUpRight } from "lucide-react";
import { formatFullRu } from "@/lib/dates";
import {
  elapsedSince,
  remainingUntil,
  totalDaysCount,
  countdownParts,
  COUNTDOWN_THRESHOLD_DAYS,
} from "@/lib/duration";
import { useNowMs } from "./clock";
import { SpanHero, TrackingTiles } from "./TrackingParts";
import { eventAccent } from "@/lib/accent";
import { resolveIconOrNull } from "@/lib/icons";
import { getSignificanceMeta } from "@/lib/significance";
import { SignificanceIcon } from "@/components/ui/SignificanceIcon";
import { CoverPlaceholder } from "@/components/ui/CoverPlaceholder";
import type { TimelineEvent } from "@/db/queries/events";
import type { Significance } from "@/lib/constants";
import { MediaImg } from "@/components/ui/MediaImg";

const ELEVATION_1 = "var(--ds-shadow-1)";
const ELEVATION_2 = "var(--ds-shadow-2)";

const pad = (n: number) => String(n).padStart(2, "0");

export function TrackingCard({
  event,
  variant,
  highlight,
  onClick,
}: {
  event: TimelineEvent;
  variant: "past" | "future";
  highlight?: boolean;
  onClick: (event: TimelineEvent) => void;
}) {
  const accent = eventAccent(event);
  const Icon = resolveIconOrNull(event.category_icon);
  const sig = getSignificanceMeta(event.significance);
  const isFuture = variant === "future";

  const total = totalDaysCount(event.date);
  const live = isFuture && total <= COUNTDOWN_THRESHOLD_DAYS;
  const now = useNowMs(live);
  const countdown = live && now !== null ? countdownParts(event.date, now) : null;

  const days = countdown ? (countdown.done ? null : countdown.days) : total;
  const subs = [
    total >= 30 ? (isFuture ? remainingUntil : elapsedSince)(event.date) : "",
    countdown && !countdown.done
      ? `и ${pad(countdown.hours)}:${pad(countdown.minutes)}:${pad(countdown.seconds)}`
      : "",
  ].filter(Boolean);

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

      <div className="relative aspect-video w-full overflow-hidden rounded-b-4xl">
        {event.cover ? (
          <MediaImg path={event.cover} className="h-full w-full object-cover" />
        ) : (
          <CoverPlaceholder fill={accent.fill} icon={event.category_icon} onAccent={highlight} />
        )}

        {event.category_name && (
          <span
            className="absolute left-4 top-4 z-10 inline-flex max-w-[60%] items-center gap-1.5 truncate rounded-full px-3 py-1.5 text-xs font-medium"
            style={{
              background: accent.fill,
              color: accent.onFill,
              boxShadow: "var(--ds-shadow-1)",
            }}
            title={event.category_name}
          >
            {Icon && createElement(Icon, { size: 13 })}
            {event.category_name}
          </span>
        )}

        <span
          className="absolute bottom-4 left-4 z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-app-text backdrop-blur"
          style={{
            background: "color-mix(in srgb, var(--rg-surface) 85%, transparent)",
            boxShadow: "var(--ds-shadow-1)",
          }}
        >
          <SignificanceIcon level={event.significance as Significance} size={13} />
          {sig.label}
        </span>

        <span
          aria-hidden
          className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] group-hover:scale-105"
          style={{
            background: highlight ? "var(--ds-on-accent)" : "var(--rg-bg)",
            color: highlight ? "var(--rg-amber)" : "var(--rg-text)",
          }}
        >
          <ArrowUpRight size={18} strokeWidth={2} />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <h3 className="line-clamp-2 text-[22px] font-bold leading-[1.15] tracking-[-0.01em]">{event.title}</h3>
          <p className={`mt-0.5 text-sm ${highlight ? "opacity-65" : "text-muted"}`}>{formatFullRu(event.date)}</p>
        </div>

        <SpanHero label={isFuture ? "осталось" : "прошло"} days={days} subs={subs} onAccent={highlight} />

        <div className="mt-auto">
          <TrackingTiles dateISO={event.date} onAccent={highlight} />
        </div>
      </div>
    </button>
  );
}
