import { eventSurface } from "@/components/events/useEventSurface";
import { createElement, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Viewport } from "@/lib/projection";
import { eventAccent } from "@/lib/accent";
import { resolveIconOrNull } from "@/lib/icons";
import { isFuture } from "@/lib/duration";
import { isPeriod } from "@/lib/timelineLayer";
import { EMPTY_FILTER, isFilterActive, matchesFilter, type EventFilter } from "@/lib/filter";
import { planPeriods, layoutPeriods, barOffsetY, type PeriodBar } from "./periods";
import { EventTooltip, type TooltipAnchor } from "./EventTooltip";
import type { TimelineEvent } from "@/db/queries/events";

const AXIS_PADDING_PX = 64;
const LABEL_MIN_HEIGHT = 11;
const LABEL_MIN_WIDTH = 70;
const ICON_MIN_WIDTH = 96;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const SPRING = { type: "spring" as const, bounce: 0, duration: 0.45 };

type Props = {
  events: TimelineEvent[];
  viewport: Viewport;
  width: number;
  height: number;
  filter?: EventFilter;
  highlightId?: number | null;
  onEventClick?: (event: TimelineEvent) => void;
};

export function PeriodLayer({
  events,
  viewport,
  width,
  height,
  filter = EMPTY_FILTER,
  highlightId = null,
  onEventClick,
}: Props) {
  const axisY = height / 2;
  const filterOn = isFilterActive(filter);
  const [hovered, setHovered] = useState<PeriodBar | null>(null);

  const plan = useMemo(
    () => planPeriods(events.filter((ev) => isPeriod(ev) && (!filterOn || matchesFilter(ev, filter)))),
    [events, filter, filterOn],
  );

  const { bars, barHeight, step } = useMemo(
    () => layoutPeriods(plan, viewport, width, Math.max(0, axisY - AXIS_PADDING_PX)),
    [plan, viewport, width, axisY],
  );

  const emptyHint = useMemo<string | null>(() => {
    if (width <= 0 || bars.length > 0) return null;
    if (plan.placements.length > 0) return "В этом диапазоне нет периодов.";
    if (filterOn) return "Ничего не найдено по фильтру.";
    return "Периодов пока нет. Укажите событию дату окончания — оно появится здесь полосой.";
  }, [bars.length, plan.placements.length, width, filterOn]);

  const highlighted = highlightId != null ? bars.find((b) => b.ev.id === highlightId) : undefined;
  const fontSize = clamp(Math.round(barHeight * 0.6), 10, 14);
  const iconSize = clamp(Math.round(barHeight * 0.7), 10, 16);

  const tooltipAnchor: TooltipAnchor | null = hovered
    ? {
        x: Math.min(Math.max((hovered.x1 + hovered.x2) / 2, 8), Math.max(8, width - 8)),
        y: axisY + barOffsetY(hovered, step) - barHeight / 2 - 10,
        events: [hovered.ev],
      }
    : null;

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      initial={{ opacity: 0, scaleY: 0.6 }}
      animate={{ opacity: 1, scaleY: 1 }}
      exit={{ opacity: 0, scaleY: 0.6 }}
      transition={SPRING}
    >
      <AnimatePresence initial={false}>
        {bars.map((bar) => {
          const { fill: color, onFill } = eventAccent(bar.ev);
          const future = isFuture(bar.ev.date);
          const barWidth = bar.x2 - bar.x1;
          const offsetY = barOffsetY(bar, step);
          const showLabel = barHeight >= LABEL_MIN_HEIGHT && barWidth >= LABEL_MIN_WIDTH;
          const Icon = resolveIconOrNull(bar.ev.category_icon);
          const showIcon = showLabel && barWidth >= ICON_MIN_WIDTH && Icon != null;

          return (
            <motion.div
              key={`period-${bar.ev.id}`}
              className="pointer-events-auto absolute flex cursor-pointer items-center overflow-hidden rounded-full"
              style={{
                left: bar.x1,
                top: axisY,
                width: barWidth,
                height: barHeight,
                originX: 0,
                background: future
                  ? `color-mix(in srgb, ${color} 22%, var(--rg-bg))`
                  : color,
                border: future ? `1.5px dashed ${color}` : undefined,
                color: future ? color : onFill,
              }}
              initial={{ opacity: 0, scaleX: 0.35, y: -barHeight / 2 }}
              animate={{
                opacity: future ? 0.85 : 1,
                scaleX: 1,
                y: offsetY - barHeight / 2,
              }}
              exit={{ opacity: 0, scaleX: 0.35, y: -barHeight / 2 }}
              transition={{ ...SPRING, delay: Math.min(bar.depth * 0.025, 0.2) }}
              onMouseEnter={() => setHovered(bar)}
              onMouseLeave={() => setHovered((h) => (h === bar ? null : h))}
              onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
              onPointerUp={(e: React.PointerEvent) => e.stopPropagation()}
              onClick={() => onEventClick?.(bar.ev)}
              {...eventSurface(bar.ev.id)}
            >
              {showLabel && (
                <span
                  className="flex min-w-0 items-center gap-1.5 px-2.5 font-medium leading-none"
                  style={{ fontSize }}
                >
                  {showIcon &&
                    Icon &&
                    createElement(Icon, { size: iconSize, strokeWidth: 1.75, className: "shrink-0" })}
                  <span className="truncate">{bar.ev.title}</span>
                </span>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      <AnimatePresence>
        {highlighted && (
          <motion.div
            key="period-highlight"
            className="pointer-events-none absolute z-10 rounded-full border-2 border-amber"
            style={{
              left: highlighted.x1 - 5,
              top: axisY + barOffsetY(highlighted, step) - barHeight / 2 - 5,
              width: highlighted.x2 - highlighted.x1 + 10,
              height: barHeight + 10,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.9, 0.15] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, repeat: Infinity, repeatType: "reverse" as const }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {emptyHint && (
          <motion.div
            key="periods-empty"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none absolute left-1/2 max-w-sm -translate-x-1/2 px-4 text-center text-sm text-muted"
            style={{ top: axisY + 36 }}
          >
            {emptyHint}
          </motion.div>
        )}
      </AnimatePresence>

      <EventTooltip anchor={tooltipAnchor} width={width} />
    </motion.div>
  );
}
