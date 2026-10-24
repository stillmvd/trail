import { createElement, useState } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { Bell, Pencil, Trash2 } from "lucide-react";
import { useReminders } from "@/components/events/RemindersProvider";
import { SpanHero, TrackingTiles } from "@/components/tracking/TrackingParts";
import { formatFullRu, formatDayMonthRu } from "@/lib/dates";
import { elapsedSince, remainingUntil, formatYMD, isFuture, totalDaysCount } from "@/lib/duration";
import { getSignificanceMeta } from "@/lib/significance";
import { eventAccent } from "@/lib/accent";
import { resolveIconOrNull } from "@/lib/icons";
import { mediaSrc } from "@/lib/paths";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { SignificanceIcon } from "@/components/ui/SignificanceIcon";
import { MetricChip } from "@/components/ui/MetricChip";
import { Lightbox } from "@/components/ui/Lightbox";
import { SideSheet } from "@/components/ui/SideSheet";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { CoverPlaceholder } from "@/components/ui/CoverPlaceholder";
import { EventForm, type EventFormPayload, type EventFormValues } from "./EventForm";
import { MarkForm, type MarkFormPayload } from "./MarkForm";
import type { CategoryNode } from "@/db/queries/categories";
import type { MarkType } from "@/db/queries/markTypes";
import type { TimelineEvent } from "@/db/queries/events";
import type { EventMedia } from "@/db/queries/media";
import type { Significance } from "@/lib/constants";

export type EventSheetState =
  | { mode: "create"; dateISO: string }
  | { mode: "view"; event: TimelineEvent; media: EventMedia[] }
  | { mode: "edit"; event: TimelineEvent; media: EventMedia[] };

export function splitCategory(
  cats: CategoryNode[],
  catId: number | null,
): { categoryId: number | null; subcategoryId: number | null } {
  if (catId === null) return { categoryId: null, subcategoryId: null };
  for (const c of cats) {
    if (c.id === catId) return { categoryId: c.id, subcategoryId: null };
    const sub = c.children.find((ch) => ch.id === catId);
    if (sub) return { categoryId: c.id, subcategoryId: sub.id };
  }
  return { categoryId: null, subcategoryId: null };
}

interface Props {
  state: EventSheetState | null;
  categories: CategoryNode[];
  markTypes: MarkType[];
  onStartEdit: () => void;
  onCreate: (payload: EventFormPayload) => void;
  onCreateMark: (payload: MarkFormPayload) => void;
  onUpdate: (id: number, payload: EventFormPayload) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}

export function EventSheet({
  state,
  categories,
  markTypes,
  onStartEdit,
  onCreate,
  onCreateMark,
  onUpdate,
  onDelete,
  onClose,
}: Props) {
  const [lbIndex, setLbIndex] = useState(-1);
  const [createKind, setCreateKind] = useState<"event" | "mark">("event");
  const { openCreateReminder } = useReminders();

  const close = () => {
    setLbIndex(-1);
    onClose();
  };

  const title =
    state?.mode === "create"
      ? createKind === "mark"
        ? "Новая отметка"
        : "Новое событие"
      : state?.mode === "edit"
        ? "Редактирование"
        : undefined;

  return (
    <>
      <SideSheet open={state !== null} onClose={close} title={title}>
        {state?.mode === "create" && (
          <div className="flex min-h-full flex-col gap-3.5">
            <SegmentedControl
              segments={[
                { value: "event", label: "Событие" },
                { value: "mark", label: "Отметка" },
              ]}
              value={createKind}
              onChange={setCreateKind}
            />
            {createKind === "event" ? (
              <EventForm
                key={`create-${state.dateISO}`}
                categories={categories}
                initial={{ date: state.dateISO }}
                onSubmit={onCreate}
                onCancel={close}
              />
            ) : (
              <MarkForm
                key={`mark-${state.dateISO}`}
                markTypes={markTypes}
                initialDate={state.dateISO}
                onSubmit={onCreateMark}
                onCancel={close}
              />
            )}
          </div>
        )}

        {state?.mode === "edit" && (
          <EventForm
            key={`edit-${state.event.id}`}
            mode="edit"
            categories={categories}
            initialMedia={state.media}
            initial={
              {
                title: state.event.title,
                description: state.event.description ?? "",
                date: state.event.date,
                endDate: state.event.end_date,
                significance: state.event.significance as Significance,
                track: state.event.track === 1,
                ...splitCategory(categories, state.event.category_id),
              } satisfies Partial<EventFormValues>
            }
            onSubmit={(payload) => onUpdate(state.event.id, payload)}
            onCancel={close}
            onDelete={() => onDelete(state.event.id)}
          />
        )}

        {state?.mode === "view" && (
          <div className="flex min-h-full flex-col">
            <EventView event={state.event} media={state.media} onLightbox={setLbIndex} />
            <div className="mt-auto flex items-center justify-between gap-2 pt-4">
              <Button variant="danger" onClick={() => onDelete(state.event.id)}>
                <Trash2 size={16} strokeWidth={1.75} />
                Удалить
              </Button>
              <div className="flex items-center gap-2">
                <IconButton
                  label="Напомнить об этом событии"
                  onClick={() => {
                    close();
                    openCreateReminder({
                      title: state.event.title,
                      date: state.event.date,
                      eventId: state.event.id,
                    });
                  }}
                >
                  <Bell size={17} strokeWidth={1.75} />
                </IconButton>
                <Button variant="secondary" onClick={onStartEdit}>
                  <Pencil size={16} strokeWidth={1.75} />
                  Редактировать
                </Button>
              </div>
            </div>
          </div>
        )}
      </SideSheet>

      <Lightbox
        open={state?.mode === "view" && lbIndex >= 0}
        images={(state?.mode === "view" ? state.media : []).map((m) => ({
          key: `m-${m.id}`,
          src: mediaSrc(m.path),
        }))}
        index={lbIndex < 0 ? 0 : lbIndex}
        onIndexChange={setLbIndex}
        onClose={() => setLbIndex(-1)}
      />
    </>
  );
}

function EventView({
  event,
  media,
  onLightbox,
}: {
  event: TimelineEvent;
  media: EventMedia[];
  onLightbox: (i: number) => void;
}) {
  const sig = getSignificanceMeta(event.significance);
  const accent = eventAccent(event);
  const Icon = resolveIconOrNull(event.category_icon);
  const images = media.map((m) => ({ key: `m-${m.id}`, src: mediaSrc(m.path) }));
  const period = event.end_date !== null;
  const future = isFuture(event.date);
  const dateLabel = period
    ? `${formatDayMonthRu(event.date)} ↔ ${formatFullRu(event.end_date as string)}`
    : formatFullRu(event.date);

  const days = period
    ? differenceInCalendarDays(parseISO(event.end_date as string), parseISO(event.date))
    : totalDaysCount(event.date);
  const ymd = period
    ? formatYMD(event.date, event.end_date as string)
    : future
      ? remainingUntil(event.date)
      : elapsedSince(event.date);

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => images.length > 0 && onLightbox(0)}
        disabled={images.length === 0}
        className="block aspect-video w-full overflow-hidden rounded-3xl disabled:cursor-default"
      >
        {images.length > 0 ? (
          <img src={images[0].src} alt="" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <CoverPlaceholder fill={accent.fill} icon={event.category_icon} />
        )}
      </button>

      <div>
        <h3 className="text-2xl font-bold leading-tight tracking-tight text-app-text">
          {event.title}
        </h3>
        <p className="mt-0.5 text-sm text-muted">{dateLabel}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {event.category_name && (
          <span
            className="inline-flex min-w-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
            style={{ background: accent.fill, color: accent.onFill }}
          >
            {Icon && createElement(Icon, { size: 12 })}
            <span className="truncate">{event.category_name}</span>
          </span>
        )}
        <MetricChip
          icon={<SignificanceIcon level={event.significance as Significance} size={12} />}
          value={sig.label}
        />
      </div>

      <SpanHero
        label={period ? "длительность" : future ? "осталось" : "прошло"}
        days={days}
        subs={days >= 30 ? [ymd] : []}
      />

      <TrackingTiles dateISO={event.date} />

      {event.description && (
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-app-text/90">
          {event.description}
        </p>
      )}
    </div>
  );
}
