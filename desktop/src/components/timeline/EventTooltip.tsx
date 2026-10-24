import { AnimatePresence, motion } from "motion/react";
import { formatFullRu, formatDayMonthRu } from "@/lib/dates";
import type { TimelineEvent } from "@/db/queries/events";
import { MediaImg } from "@/components/ui/MediaImg";

const TOOLTIP_HALF_PX = 196;

export type TooltipAnchor = { x: number; y: number; events: TimelineEvent[] };

export function EventTooltip({ anchor, width }: { anchor: TooltipAnchor | null; width: number }) {
  return (
    <AnimatePresence>
      {anchor && (
        <motion.div
          key="tooltip"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.12 }}
          className="pointer-events-none absolute z-20 w-max min-w-[13rem] max-w-sm -translate-x-1/2 -translate-y-full rounded-2xl bg-surface-3 px-3.5 py-2.5 shadow-lg"
          style={{
            left: Math.min(
              Math.max(anchor.x, TOOLTIP_HALF_PX),
              Math.max(TOOLTIP_HALF_PX, width - TOOLTIP_HALF_PX),
            ),
            top: anchor.y,
          }}
        >
          {anchor.events.length === 1 ? (
            <>
              {anchor.events[0].cover && (
                <MediaImg path={anchor.events[0].cover} className="img-outline mb-2 h-24 w-full rounded-2xl object-cover" />
              )}
              <div className="text-[13px] font-semibold text-app-text">{anchor.events[0].title}</div>
              <div className="text-xs text-muted">
                {anchor.events[0].end_date
                  ? `${formatDayMonthRu(anchor.events[0].date)} — ${formatFullRu(anchor.events[0].end_date)}`
                  : formatFullRu(anchor.events[0].date)}
              </div>
            </>
          ) : (
            <>
              <div className="mb-1 text-xs font-medium text-muted">
                {anchor.events.length} событий
              </div>
              {anchor.events.slice(0, 6).map((e) => (
                <div key={e.id} className="truncate text-[13px] text-app-text">
                  <span className="text-muted">{formatDayMonthRu(e.date)}</span> {e.title}
                </div>
              ))}
              {anchor.events.length > 6 && (
                <div className="text-xs text-muted">…ещё {anchor.events.length - 6}</div>
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
