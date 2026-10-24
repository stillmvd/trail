import { createElement, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Pencil, Trash2, Plus, X } from "lucide-react";
import { formatFullRu, formatDayMonthRu } from "@/lib/dates";
import { getSignificanceMeta } from "@/lib/significance";
import { eventAccent } from "@/lib/accent";
import { resolveIconOrNull } from "@/lib/icons";
import { mediaSrc } from "@/lib/paths";
import { Button } from "@/components/ui/Button";
import { MetricChip } from "@/components/ui/MetricChip";
import { SignificanceIcon } from "@/components/ui/SignificanceIcon";
import { ContextMenu } from "@/components/ui/ContextMenu";
import { CoverPlaceholder } from "@/components/ui/CoverPlaceholder";
import type { TimelineEvent } from "@/db/queries/events";
import type { Mark } from "@/db/queries/marks";
import type { Significance } from "@/lib/constants";
import { useBack } from "@/lib/back";

interface DayEventsDialogProps {
  open: boolean;
  dateISO: string | null;
  events: TimelineEvent[];
  marks: Mark[];
  onView: (event: TimelineEvent) => void;
  onEdit: (event: TimelineEvent) => void;
  onDelete: (event: TimelineEvent) => void;
  onDeleteMark: (mark: Mark) => void;
  onCreate: (dateISO: string) => void;
  onClose: () => void;
}

// «12 июля 2026» → «12 июля»: год выносим в светлое начертание рядом.
const dayMonth = (iso: string) => formatFullRu(iso).replace(` ${iso.slice(0, 4)}`, "");

const isPeriod = (e: TimelineEvent) => !!e.end_date && e.end_date > e.date;

const dateLabel = (e: TimelineEvent) =>
  e.end_date ? `${formatDayMonthRu(e.date)} ↔ ${formatFullRu(e.end_date)}` : formatFullRu(e.date);

export function DayEventsDialog({
  open,
  dateISO,
  events,
  marks,
  onView,
  onEdit,
  onDelete,
  onDeleteMark,
  onCreate,
  onClose,
}: DayEventsDialogProps) {
  const [menu, setMenu] = useState<{ event: TimelineEvent; x: number; y: number } | null>(null);

  const periods = events.filter(isPeriod);
  const moments = events.filter((e) => !isPeriod(e));
  const total = events.length + marks.length;
  const groupsCount =
    (periods.length > 0 ? 1 : 0) + (moments.length > 0 ? 1 : 0) + (marks.length > 0 ? 1 : 0);
  const showLabels = groupsCount >= 2;

  useBack(open, onClose);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[86] flex items-center justify-center p-4"
          style={{ background: "var(--rg-scrim)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className="flex max-h-[80vh] w-full max-w-[568px] flex-col rounded-4xl bg-surface-1 text-app-text shadow-2xl"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", duration: 0.28, bounce: 0.18 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="flex shrink-0 items-start justify-between gap-3 px-6 pb-4 pt-6">
              <div>
                <h2 className="text-[26px] leading-tight tracking-tight text-app-text">
                  {dateISO ? (
                    <>
                      <span className="font-bold">{dayMonth(dateISO)}</span>{" "}
                      <span className="font-light text-muted">{dateISO.slice(0, 4)}</span>
                    </>
                  ) : (
                    <span className="font-bold">События</span>
                  )}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {total} {plural(total)}
                </p>
              </div>
              <button
                type="button"
                aria-label="Закрыть"
                onClick={onClose}
                className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full bg-surface-2 text-app-text transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] hover:bg-surface-3 active:scale-[0.96]"
              >
                <X size={20} strokeWidth={1.75} />
              </button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-5">
              {showLabels && periods.length > 0 && <GroupLabel label="Периоды" />}
              {periods.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  onView={() => onView(event)}
                  onContextMenu={(x, y) => setMenu({ event, x, y })}
                />
              ))}
              {showLabels && moments.length > 0 && <GroupLabel label="События" />}
              {moments.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  onView={() => onView(event)}
                  onContextMenu={(x, y) => setMenu({ event, x, y })}
                />
              ))}
              {showLabels && marks.length > 0 && <GroupLabel label="Отметки" />}
              {marks.map((mark) => (
                <MarkRow key={mark.id} mark={mark} onDelete={() => onDeleteMark(mark)} />
              ))}
            </div>

            <div className="flex shrink-0 justify-end px-6 pb-6 pt-4">
              <Button onClick={() => dateISO && onCreate(dateISO)}>
                <Plus size={16} strokeWidth={1.75} />
                Добавить событие
              </Button>
            </div>
          </motion.div>

          <ContextMenu
            open={menu !== null}
            x={menu?.x ?? 0}
            y={menu?.y ?? 0}
            onClose={() => setMenu(null)}
            items={
              menu
                ? [
                    {
                      label: "Редактировать",
                      icon: <Pencil size={16} strokeWidth={1.75} />,
                      onSelect: () => onEdit(menu.event),
                    },
                    {
                      label: "Удалить",
                      icon: <Trash2 size={16} strokeWidth={1.75} />,
                      danger: true,
                      onSelect: () => onDelete(menu.event),
                    },
                  ]
                : []
            }
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function EventRow({
  event,
  onView,
  onContextMenu,
}: {
  event: TimelineEvent;
  onView: () => void;
  onContextMenu: (x: number, y: number) => void;
}) {
  const accent = eventAccent(event);
  const sig = getSignificanceMeta(event.significance);
  const Icon = resolveIconOrNull(event.category_icon);

  return (
    <button
      type="button"
      onClick={onView}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e.clientX, e.clientY);
      }}
      className="group flex cursor-pointer items-center gap-3.5 rounded-3xl p-2.5 text-left transition-colors hover:bg-surface-2"
    >
      {event.cover ? (
        <img
          src={mediaSrc(event.cover)}
          alt=""
          loading="lazy"
          decoding="async"
          className="img-outline h-16 w-16 shrink-0 rounded-2xl object-cover"
        />
      ) : (
        <span className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
          <CoverPlaceholder fill={accent.fill} icon={event.category_icon} />
        </span>
      )}

      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="truncate text-[15px] font-bold tracking-tight text-app-text">
          {event.title}
        </span>
        {isPeriod(event) && (
          <span className="truncate text-xs text-muted">{dateLabel(event)}</span>
        )}
        <span className="flex">
          <span
            className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2.5 py-1 text-xs font-medium"
            style={
              event.category_name
                ? { background: accent.fill, color: accent.onFill }
                : { background: "var(--ds-surface-3)", color: "var(--rg-muted)" }
            }
          >
            {Icon && createElement(Icon, { size: 11 })}
            {event.category_name ?? "Без категории"}
          </span>
        </span>
      </span>

      <span className="shrink-0 self-center">
        <MetricChip
          icon={<SignificanceIcon level={event.significance as Significance} size={12} />}
          value={sig.label}
        />
      </span>
    </button>
  );
}

function MarkRow({ mark, onDelete }: { mark: Mark; onDelete: () => void }) {
  const Icon = resolveIconOrNull(mark.type_icon);
  return (
    <div className="group flex items-center gap-3.5 rounded-3xl p-2.5">
      <span
        className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl"
        style={{
          background: `color-mix(in srgb, ${mark.type_color} 20%, var(--rg-surface))`,
          color: mark.type_color,
        }}
      >
        {Icon && createElement(Icon, { size: 26, strokeWidth: 1.5 })}
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-tight text-app-text">
        {mark.type_name}
      </span>
      <button
        type="button"
        aria-label="Удалить отметку"
        onClick={onDelete}
        className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full bg-surface-2 text-muted opacity-0 transition-[opacity,color,scale] duration-150 ease-[var(--rg-ease)] hover:text-rust focus-visible:opacity-100 active:scale-[0.96] group-hover:opacity-100"
      >
        <Trash2 size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}

function GroupLabel({ label }: { label: string }) {
  return (
    <span className="mt-1.5 mb-0.5 inline-flex w-fit rounded-full bg-surface-2 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
      {label}
    </span>
  );
}

function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "событие";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "события";
  return "событий";
}
