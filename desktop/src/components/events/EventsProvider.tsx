import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bell, Pencil, Shapes, Sparkles, Target, Trash2 } from "lucide-react";
import { CategorySheet } from "@/components/timeline/CategoryPicker";
import { reminderFromEvent } from "@/lib/reminders";
import { searchOpenStore } from "@/lib/search";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ContextMenu, type ContextMenuItem } from "@/components/ui/ContextMenu";
import { EventSheet, splitCategory, type EventSheetState } from "@/components/timeline/EventSheet";
import { DayEventsDialog } from "@/components/timeline/DayEventsDialog";
import { ImageGenDialog } from "@/components/timeline/ImageGenDialog";
import { useReminders } from "./RemindersProvider";
import { useEventSurface } from "./useEventSurface";
import { mediaSrc } from "@/lib/paths";
import { addDaysISO, formatDayMonthRu, formatFullRu, todayISO } from "@/lib/dates";
import type { CategoryNode } from "@/db/queries/categories";

const eventDateLabel = (e: TimelineEvent) =>
  e.end_date ? `${formatDayMonthRu(e.date)} ↔ ${formatFullRu(e.end_date)}` : formatFullRu(e.date);
import type { EventFormPayload } from "@/components/timeline/EventForm";
import type { MarkFormPayload } from "@/components/timeline/MarkForm";
import { useQuery, getQueryData, setQueryData } from "@/lib/useQuery";
import { listAllEvents, loadTimeline, loadCalendar } from "@/db/queries/loaders";
import { bumpDataVersion } from "@/lib/dataVersion";
import {
  TIMELINE_MIN_DATE,
  TIMELINE_MAX_DATE,
  isValidISODate,
} from "@/lib/constants";
import {
  createEvent,
  updateEvent,
  deleteEvent,
  getEvent,
  getEventsInRange,
} from "@/db/queries/events";
import { listMediaByEvent, addMedia, deleteMedia } from "@/db/queries/media";
import { createMark, deleteMark, getMarksInRange } from "@/db/queries/marks";
import { listCategories } from "@/db/queries/categories";
import { listMarkTypes, type MarkType } from "@/db/queries/markTypes";
import { writeMediaFile, deleteMediaFile } from "@/lib/media";
import type { TimelineEvent } from "@/db/queries/events";
import type { Mark } from "@/db/queries/marks";

type DayState = { dateISO: string; events: TimelineEvent[]; marks: Mark[] };
type Calendar = Awaited<ReturnType<typeof loadCalendar>>;

type EventsCtx = {
  openCreate: (dateISO: string) => void;
  openView: (event: TimelineEvent) => void;
  openDay: (dateISO: string) => void;
  openMarkMenu: (mark: Mark, x: number, y: number) => void;
  savePhoto: (eventId: number, file: File) => Promise<string | null>;
  moveEvent: (eventId: number, dateISO: string) => void;
  toggleMark: (type: MarkType, dateISO: string) => void;
};

function editableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || !!target.closest("input, textarea, select"));
}

const Context = createContext<EventsCtx | null>(null);

export function useEvents() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useEvents must be used within EventsProvider");
  return ctx;
}

function validate(p: EventFormPayload): string | null {
  if (!p.title.trim()) return "Название не может быть пустым";
  if (!isValidISODate(p.date) || p.date < TIMELINE_MIN_DATE || p.date > TIMELINE_MAX_DATE)
    return "Некорректная дата";
  if (p.endDate) {
    if (!isValidISODate(p.endDate) || p.endDate < TIMELINE_MIN_DATE || p.endDate > TIMELINE_MAX_DATE)
      return "Некорректная дата конца";
    if (p.endDate < p.date) return "Дата конца раньше даты начала";
  }
  return null;
}

const eventInput = (p: EventFormPayload) => ({
  title: p.title.trim(),
  description: p.description.trim() || null,
  date: p.date,
  endDate: p.endDate,
  significance: p.significance,
  categoryId: p.categoryId,
  track: p.track ? 1 : 0,
});

async function finalizePhoto(eventId: number, photo: EventFormPayload["photo"]): Promise<string | null> {
  if (photo.kind === "keep") return null;
  const old = await listMediaByEvent(eventId);
  const next = photo.kind === "set" ? await writeMediaFile(photo.file) : null;
  if (next) {
    try {
      await addMedia(eventId, next);
    } catch (e) {
      await deleteMediaFile(next).catch(() => undefined);
      throw e;
    }
  }
  for (const m of old) {
    const path = await deleteMedia(m.id).catch(() => null);
    if (path) await deleteMediaFile(path).catch(() => undefined);
  }
  return next;
}

const photoQueue = new Map<number, Promise<unknown>>();

function queuePhoto<T>(eventId: number, task: () => Promise<T>): Promise<T> {
  const run = (photoQueue.get(eventId) ?? Promise.resolve()).then(task, task);
  const tail = run.catch(() => undefined);
  photoQueue.set(eventId, tail);
  void tail.then(() => photoQueue.get(eventId) === tail && photoQueue.delete(eventId));
  return run;
}

const quickInput = (e: TimelineEvent) => ({
  title: e.title,
  description: e.description,
  date: e.date,
  endDate: e.end_date,
  significance: e.significance,
  categoryId: e.category_id,
  track: e.track,
});

function categoryPath(categories: CategoryNode[], id: number | null): string {
  const { categoryId, subcategoryId } = splitCategory(categories, id);
  const parent = categories.find((c) => c.id === categoryId);
  const sub = parent?.children.find((c) => c.id === subcategoryId);
  return [parent?.name, sub?.name].filter(Boolean).join(" › ");
}

export function EventsProvider({ children }: { children: ReactNode }) {
  const { show } = useToast();
  const { data: categories } = useQuery(listCategories);
  const { data: markTypes } = useQuery(listMarkTypes);

  const [sheet, setSheet] = useState<EventSheetState | null>(null);
  const [day, setDay] = useState<DayState | null>(null);
  const [confirmEvent, setConfirmEvent] = useState<number | null>(null);
  const [markMenu, setMarkMenu] = useState<{ mark: Mark; x: number; y: number } | null>(null);

  const openCreate = useCallback((dateISO: string) => {
    setDay(null);
    setSheet({ mode: "create", dateISO });
  }, []);

  const openView = useCallback(
    async (event: TimelineEvent) => {
      try {
        const media = await listMediaByEvent(event.id);
        setDay(null);
        setSheet({ mode: "view", event, media });
      } catch (e) {
        show(`Не удалось открыть событие: ${String(e)}`, "error");
      }
    },
    [show],
  );

  const editEvent = useCallback(
    async (event: TimelineEvent) => {
      try {
        const media = await listMediaByEvent(event.id);
        setSheet({ mode: "edit", event, media });
      } catch (e) {
        show(`Не удалось открыть событие: ${String(e)}`, "error");
      }
    },
    [show],
  );

  const openDay = useCallback(
    async (dateISO: string) => {
      try {
        const [all, marks] = await Promise.all([
          getEventsInRange(TIMELINE_MIN_DATE, TIMELINE_MAX_DATE),
          getMarksInRange(dateISO, dateISO),
        ]);
        const events = all.filter(
          (e) =>
            e.date === dateISO ||
            (!!e.end_date && e.date <= dateISO && e.end_date >= dateISO),
        );
        setSheet(null);
        setDay({ dateISO, events, marks });
      } catch (e) {
        show(`Не удалось открыть день: ${String(e)}`, "error");
      }
    },
    [show],
  );

  const startEdit = useCallback(() => {
    setSheet((s) => (s?.mode === "view" ? { mode: "edit", event: s.event, media: s.media } : s));
  }, []);

  const saving = useRef(false);

  const doCreate = useCallback(
    async (p: EventFormPayload) => {
      const err = validate(p);
      if (err) return show(err, "error");
      if (saving.current) return;
      saving.current = true;
      try {
        const id = await createEvent(eventInput(p));
        setSheet(null);
        try {
          await queuePhoto(id, () => finalizePhoto(id, p.photo));
        } catch (e) {
          bumpDataVersion();
          return show(`Событие создано, но фото не сохранено: ${String(e)}`, "error");
        }
        bumpDataVersion();
        show("Событие создано", "success");
      } catch (e) {
        show(`Не удалось создать событие: ${String(e)}`, "error");
      } finally {
        saving.current = false;
      }
    },
    [show],
  );

  const doUpdate = useCallback(
    async (id: number, p: EventFormPayload) => {
      const err = validate(p);
      if (err) return show(err, "error");
      if (saving.current) return;
      saving.current = true;
      try {
        await updateEvent(id, eventInput(p));
        setSheet(null);
        try {
          await queuePhoto(id, () => finalizePhoto(id, p.photo));
        } catch (e) {
          bumpDataVersion();
          return show(`Изменения сохранены, но фото не обновлено: ${String(e)}`, "error");
        }
        bumpDataVersion();
        show("Изменения сохранены", "success");
      } catch (e) {
        show(`Не удалось сохранить: ${String(e)}`, "error");
      } finally {
        saving.current = false;
      }
    },
    [show],
  );

  const doDelete = useCallback(
    async (id: number) => {
      setSheet(null);
      setDay(null);
      const snapshot = [
        getQueryData<TimelineEvent[]>(listAllEvents),
        getQueryData<Awaited<ReturnType<typeof loadTimeline>>>(loadTimeline),
        getQueryData<Awaited<ReturnType<typeof loadCalendar>>>(loadCalendar),
      ] as const;
      setQueryData<TimelineEvent[]>(listAllEvents, (d) => d && d.filter((e) => e.id !== id));
      setQueryData<Awaited<ReturnType<typeof loadTimeline>>>(
        loadTimeline,
        (d) => d && { ...d, events: d.events.filter((e) => e.id !== id) },
      );
      setQueryData<Awaited<ReturnType<typeof loadCalendar>>>(
        loadCalendar,
        (d) => d && { ...d, events: d.events.filter((e) => e.id !== id) },
      );
      try {
        const media = await listMediaByEvent(id);
        await deleteEvent(id);
        for (const m of media) await deleteMediaFile(m.path).catch(() => undefined);
        bumpDataVersion();
        show("Событие удалено", "success");
      } catch (e) {
        setQueryData(listAllEvents, snapshot[0]);
        setQueryData(loadTimeline, snapshot[1]);
        setQueryData(loadCalendar, snapshot[2]);
        bumpDataVersion();
        show(`Не удалось удалить событие: ${String(e)}`, "error");
      }
    },
    [show],
  );

  const doCreateMark = useCallback(
    async (p: MarkFormPayload) => {
      if (saving.current) return;
      saving.current = true;
      try {
        await createMark(p);
        setSheet(null);
        bumpDataVersion();
        show("Отметка создана", "success");
      } catch (e) {
        show(`Не удалось создать отметку: ${String(e)}`, "error");
      } finally {
        saving.current = false;
      }
    },
    [show],
  );

  const doDeleteMark = useCallback(
    async (mark: Mark) => {
      setDay((d) => (d ? { ...d, marks: d.marks.filter((m) => m.id !== mark.id) } : d));
      try {
        await deleteMark(mark.id);
        bumpDataVersion();
        show("Отметка удалена", "success");
      } catch (e) {
        setDay((d) => (d ? { ...d, marks: [...d.marks, mark] } : d));
        show(`Не удалось удалить отметку: ${String(e)}`, "error");
      }
    },
    [show],
  );

  const openMarkMenu = useCallback((mark: Mark, x: number, y: number) => {
    setMarkMenu({ mark, x, y });
  }, []);

  const patchDay = useCallback(
    (eventId: number, patch: Partial<TimelineEvent>) =>
      setDay((d) => d && { ...d, events: d.events.map((e) => (e.id === eventId ? { ...e, ...patch } : e)) }),
    [],
  );

  const savePhoto = useCallback(
    async (eventId: number, file: File) => {
      try {
        const path = await queuePhoto(eventId, () => finalizePhoto(eventId, { kind: "set", file }));
        bumpDataVersion();
        const media = await listMediaByEvent(eventId);
        setSheet((s) =>
          s?.mode === "view" && s.event.id === eventId ? { ...s, media, event: { ...s.event, cover: path } } : s,
        );
        patchDay(eventId, { cover: path });
        show("Картинка сохранена", "success");
        return path;
      } catch (e) {
        show(`Не удалось сохранить картинку: ${String(e)}`, "error");
        return null;
      }
    },
    [show, patchDay],
  );

  const { openCreateReminder } = useReminders();
  const [eventMenu, setEventMenu] = useState<{ event: TimelineEvent; x: number; y: number } | null>(null);
  const [genEvent, setGenEvent] = useState<TimelineEvent | null>(null);
  const [catEvent, setCatEvent] = useState<TimelineEvent | null>(null);
  const menuTicket = useRef(0);

  const quickUpdate = useCallback(
    async (event: TimelineEvent, patch: Partial<TimelineEvent>, done: string) => {
      try {
        const fresh = (await getEvent(event.id)) ?? event;
        await updateEvent(event.id, quickInput({ ...fresh, ...patch }));
        bumpDataVersion();
        patchDay(event.id, patch);
        setSheet((s) => (s?.mode === "view" && s.event.id === event.id ? { ...s, event: { ...s.event, ...patch } } : s));
        show(done, "success");
      } catch (e) {
        show(`Не удалось сохранить: ${String(e)}`, "error");
      }
    },
    [show, patchDay],
  );

  const moveEvent = useCallback(
    async (eventId: number, dateISO: string) => {
      const event = await getEvent(eventId).catch(() => null);
      if (!event || event.date === dateISO) return;
      if (dateISO < TIMELINE_MIN_DATE || dateISO > TIMELINE_MAX_DATE) return show("Дата вне диапазона таймлайна", "error");
      const shift = differenceInCalendarDays(parseISO(dateISO), parseISO(event.date));
      const patch = { date: dateISO, end_date: event.end_date && addDaysISO(event.end_date, shift) };
      if (patch.end_date && patch.end_date > TIMELINE_MAX_DATE) return show("Дата вне диапазона таймлайна", "error");
      const snapshot = getQueryData<Calendar>(loadCalendar);
      setQueryData<Calendar>(
        loadCalendar,
        (d) => d && { ...d, events: d.events.map((e) => (e.id === eventId ? { ...e, ...patch } : e)) },
      );
      try {
        await updateEvent(eventId, quickInput({ ...event, ...patch }));
        bumpDataVersion();
        show(`Перенесено на ${formatFullRu(dateISO)}`, "success");
      } catch (e) {
        setQueryData(loadCalendar, snapshot);
        show(`Не удалось перенести: ${String(e)}`, "error");
      }
    },
    [show],
  );

  const toggleMark = useCallback(
    async (type: MarkType, dateISO: string) => {
      const snapshot = getQueryData<Calendar>(loadCalendar);
      const existing = snapshot?.marks.find((m) => m.date === dateISO && m.type_id === type.id);
      if (existing && existing.id < 0) return;
      setQueryData<Calendar>(loadCalendar, (d) =>
        d && {
          ...d,
          marks: existing
            ? d.marks.filter((m) => m.id !== existing.id)
            : [
                ...d.marks,
                { id: -Date.now(), date: dateISO, type_id: type.id, type_name: type.name, type_icon: type.icon, type_color: type.color },
              ],
        },
      );
      try {
        if (existing) await deleteMark(existing.id);
        else await createMark({ date: dateISO, markTypeId: type.id });
        bumpDataVersion();
      } catch (e) {
        if (snapshot) setQueryData<Calendar>(loadCalendar, (d) => d && { ...d, marks: snapshot.marks });
        show(`Не удалось ${existing ? "снять" : "поставить"} отметку: ${String(e)}`, "error");
      }
    },
    [show],
  );

  const setCategory = useCallback(
    (event: TimelineEvent, categoryId: number | null) => {
      const cat = (categories ?? []).flatMap((c) => [c, ...c.children]).find((c) => c.id === categoryId) ?? null;
      void quickUpdate(
        event,
        {
          category_id: cat?.id ?? null,
          category_name: cat?.name ?? null,
          category_icon: cat?.icon ?? null,
          category_color: cat?.color ?? null,
        },
        cat ? `Категория: ${categoryPath(categories ?? [], cat.id)}` : "Категория снята",
      );
    },
    [categories, quickUpdate],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyN" || e.altKey || e.shiftKey || e.repeat) return;
      if (!(e.ctrlKey || e.metaKey) && editableTarget(e.target)) return;
      if (searchOpenStore.get() || document.querySelector("[aria-modal='true']")) return;
      e.preventDefault();
      openCreate(todayISO());
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openCreate]);

  useEventSurface({
    onMenu: async (id, x, y) => {
      const ticket = ++menuTicket.current;
      const event = await getEvent(id).catch(() => null);
      if (event && ticket === menuTicket.current) setEventMenu({ event, x, y });
    },
    onImage: (id, file) => void savePhoto(id, file),
    onImageError: (message) => show(message, "error"),
  });

  const eventMenuItems = (event: TimelineEvent): ContextMenuItem[] => [
    {
      label: "Изменить",
      icon: <Pencil size={16} strokeWidth={1.75} />,
      onSelect: () => {
        setDay(null);
        void editEvent(event);
      },
    },
    {
      label: "Открыть генератор изображений",
      icon: <Sparkles size={16} strokeWidth={1.75} />,
      onSelect: () => setGenEvent(event),
    },
    {
      label: "Отслеживать",
      icon: <Target size={16} strokeWidth={1.75} />,
      checked: event.track === 1,
      onSelect: () =>
        void quickUpdate(
          event,
          { track: event.track === 1 ? 0 : 1 },
          event.track === 1 ? "Убрано из «Отслеживания»" : "Добавлено в «Отслеживание»",
        ),
    },
    {
      label: "Сменить категорию…",
      icon: <Shapes size={16} strokeWidth={1.75} />,
      onSelect: () => {
        setDay(null);
        setCatEvent(event);
      },
    },
    {
      label: "Напомнить",
      icon: <Bell size={16} strokeWidth={1.75} />,
      onSelect: () => {
        setDay(null);
        openCreateReminder(reminderFromEvent(event));
      },
    },
    { type: "separator" },
    {
      label: "Удалить",
      icon: <Trash2 size={16} strokeWidth={1.75} />,
      danger: true,
      onSelect: () => setConfirmEvent(event.id),
    },
  ];

  const ctx = useMemo(
    () => ({ openCreate, openView, openDay, openMarkMenu, savePhoto, moveEvent, toggleMark }),
    [openCreate, openView, openDay, openMarkMenu, savePhoto, moveEvent, toggleMark],
  );

  const requestDelete = useCallback((id: number) => setConfirmEvent(id), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  return (
    <Context.Provider value={ctx}>
      {children}

      <EventSheet
        state={sheet}
        categories={categories ?? []}
        markTypes={markTypes ?? []}
        onStartEdit={startEdit}
        onCreate={doCreate}
        onCreateMark={doCreateMark}
        onUpdate={doUpdate}
        onDelete={requestDelete}
        onClose={closeSheet}
      />

      <DayEventsDialog
        open={day !== null}
        dateISO={day?.dateISO ?? null}
        events={day?.events ?? []}
        marks={day?.marks ?? []}
        onView={openView}
        onDeleteMark={doDeleteMark}
        onCreate={openCreate}
        onClose={() => setDay(null)}
      />

      <ConfirmDialog
        open={confirmEvent !== null}
        message="Удалить это событие? Действие необратимо."
        onConfirm={() => confirmEvent !== null && doDelete(confirmEvent)}
        onClose={() => setConfirmEvent(null)}
      />

      <ContextMenu
        open={eventMenu !== null}
        x={eventMenu?.x ?? 0}
        y={eventMenu?.y ?? 0}
        onClose={() => setEventMenu(null)}
        header={eventMenu ? { title: eventMenu.event.title, subtitle: eventDateLabel(eventMenu.event) } : undefined}
        items={eventMenu ? eventMenuItems(eventMenu.event) : []}
      />

      <CategorySheet
        open={catEvent !== null}
        categories={categories ?? []}
        categoryId={catEvent?.category_id ?? null}
        onClose={() => setCatEvent(null)}
        onPick={(id) => {
          if (catEvent) setCategory(catEvent, id);
          setCatEvent(null);
        }}
      />

      <ImageGenDialog
        open={genEvent !== null}
        subject={{
          title: genEvent?.title ?? "",
          note: genEvent?.description ?? "",
          category: categoryPath(categories ?? [], genEvent?.category_id ?? null),
          currentSrc: genEvent?.cover ? mediaSrc(genEvent.cover) : null,
        }}
        applyLabel={genEvent?.cover ? "Заменить фото" : "Сохранить"}
        onClose={() => setGenEvent(null)}
        onApply={async (file) => !!genEvent && (await savePhoto(genEvent.id, file)) !== null}
      />

      <ContextMenu
        open={markMenu !== null}
        x={markMenu?.x ?? 0}
        y={markMenu?.y ?? 0}
        onClose={() => setMarkMenu(null)}
        items={
          markMenu
            ? [
                {
                  label: "Удалить отметку",
                  icon: <Trash2 size={16} />,
                  danger: true,
                  onSelect: () => doDeleteMark(markMenu.mark),
                },
              ]
            : []
        }
      />
    </Context.Provider>
  );
}
