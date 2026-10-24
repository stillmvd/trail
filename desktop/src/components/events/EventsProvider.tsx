import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ContextMenu } from "@/components/ui/ContextMenu";
import { EventSheet, type EventSheetState } from "@/components/timeline/EventSheet";
import { DayEventsDialog } from "@/components/timeline/DayEventsDialog";
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
  getEventsInRange,
} from "@/db/queries/events";
import { listMediaByEvent, addMedia, deleteMedia } from "@/db/queries/media";
import { createMark, deleteMark, getMarksInRange } from "@/db/queries/marks";
import { listCategories } from "@/db/queries/categories";
import { listMarkTypes } from "@/db/queries/markTypes";
import { writeMediaFile, deleteMediaFile } from "@/lib/media";
import type { TimelineEvent } from "@/db/queries/events";
import type { Mark } from "@/db/queries/marks";

type DayState = { dateISO: string; events: TimelineEvent[]; marks: Mark[] };

type EventsCtx = {
  openCreate: (dateISO: string) => void;
  openView: (event: TimelineEvent) => void;
  openDay: (dateISO: string) => void;
  openMarkMenu: (mark: Mark, x: number, y: number) => void;
};

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

async function finalizePhoto(eventId: number, photo: EventFormPayload["photo"]) {
  if (photo.kind === "keep") return;
  for (const m of await listMediaByEvent(eventId)) {
    const path = await deleteMedia(m.id);
    if (path) await deleteMediaFile(path);
  }
  if (photo.kind === "set") await addMedia(eventId, await writeMediaFile(photo.file));
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
          await finalizePhoto(id, p.photo);
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
          await finalizePhoto(id, p.photo);
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

  const ctx = useMemo(
    () => ({ openCreate, openView, openDay, openMarkMenu }),
    [openCreate, openView, openDay, openMarkMenu],
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
        onEdit={editEvent}
        onDelete={(e) => setConfirmEvent(e.id)}
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
