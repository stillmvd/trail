import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PersonSheet, type PersonSheetState } from "@/components/birthdays/PersonSheet";
import type { PersonFormPayload, PersonPhotoChange } from "@/components/birthdays/PersonForm";
import { bumpDataVersion } from "@/lib/dataVersion";
import { getQueryData, setQueryData } from "@/lib/useQuery";
import { TIMELINE_MIN_DATE, TIMELINE_MAX_DATE, isValidISODate } from "@/lib/constants";
import {
  createPerson,
  updatePerson,
  deletePerson,
  getPerson,
  listPeople,
  setPersonPhoto,
} from "@/db/queries/people";
import { loadCalendar } from "@/db/queries/loaders";
import { writeMediaFile, deleteMediaFile } from "@/lib/media";
import type { Person } from "@/db/queries/people";

type PeopleCtx = {
  openCreatePerson: () => void;
  openViewPerson: (person: Person) => void;
};

const Context = createContext<PeopleCtx | null>(null);

export function usePeople() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("usePeople must be used within PeopleProvider");
  return ctx;
}

function validate(p: PersonFormPayload): string | null {
  if (!p.name.trim()) return "Имя не может быть пустым";
  if (!isValidISODate(p.birthDate) || p.birthDate < TIMELINE_MIN_DATE || p.birthDate > TIMELINE_MAX_DATE)
    return "Некорректная дата рождения";
  return null;
}

async function applyPhoto(id: number, change: PersonPhotoChange, prevPhoto: string | null) {
  if (change.kind === "set") {
    const rel = await writeMediaFile(change.file);
    await setPersonPhoto(id, rel);
    if (prevPhoto) await deleteMediaFile(prevPhoto);
  } else if (change.kind === "remove") {
    await setPersonPhoto(id, null);
    if (prevPhoto) await deleteMediaFile(prevPhoto);
  }
}

type CalendarData = Awaited<ReturnType<typeof loadCalendar>>;

export function PeopleProvider({ children }: { children: ReactNode }) {
  const { show } = useToast();
  const [sheet, setSheet] = useState<PersonSheetState | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const saving = useRef(false);

  const openCreatePerson = useCallback(() => setSheet({ mode: "create" }), []);
  const openViewPerson = useCallback((person: Person) => setSheet({ mode: "view", person }), []);
  const ctx = useMemo(() => ({ openCreatePerson, openViewPerson }), [openCreatePerson, openViewPerson]);

  const startEdit = useCallback(() => {
    setSheet((s) => (s?.mode === "view" ? { mode: "edit", person: s.person } : s));
  }, []);

  const doCreate = useCallback(
    async (p: PersonFormPayload) => {
      const err = validate(p);
      if (err) return show(err, "error");
      if (saving.current) return;
      saving.current = true;
      try {
        const id = await createPerson({ name: p.name.trim(), birthDate: p.birthDate, hasYear: p.hasYear ? 1 : 0 });
        setSheet(null);
        try {
          await applyPhoto(id, p.photo, null);
        } catch (e) {
          bumpDataVersion();
          return show(`Человек добавлен, но фото не сохранено: ${String(e)}`, "error");
        }
        bumpDataVersion();
        show("Человек добавлен", "success");
      } catch (e) {
        show(`Не удалось добавить: ${String(e)}`, "error");
      } finally {
        saving.current = false;
      }
    },
    [show],
  );

  const doUpdate = useCallback(
    async (id: number, p: PersonFormPayload) => {
      const err = validate(p);
      if (err) return show(err, "error");
      if (saving.current) return;
      saving.current = true;
      try {
        const prevPhoto = sheet?.mode === "edit" ? sheet.person.photo : ((await getPerson(id))?.photo ?? null);
        await updatePerson(id, { name: p.name.trim(), birthDate: p.birthDate, hasYear: p.hasYear ? 1 : 0 });
        setSheet(null);
        try {
          await applyPhoto(id, p.photo, prevPhoto);
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
    [show, sheet],
  );

  const doDelete = useCallback(
    async (id: number) => {
      setSheet(null);
      const snapshotList = getQueryData<Person[]>(listPeople);
      const snapshotCalendar = getQueryData<CalendarData>(loadCalendar);
      const photo = snapshotList?.find((x) => x.id === id)?.photo;
      setQueryData<Person[]>(listPeople, (d) => d && d.filter((x) => x.id !== id));
      setQueryData<CalendarData>(loadCalendar, (d) => d && { ...d, people: d.people.filter((x) => x.id !== id) });
      try {
        const path = photo !== undefined ? photo : ((await getPerson(id))?.photo ?? null);
        await deletePerson(id);
        if (path) await deleteMediaFile(path).catch(() => undefined);
        bumpDataVersion();
        show("Человек удалён", "success");
      } catch (e) {
        setQueryData(listPeople, snapshotList);
        setQueryData(loadCalendar, snapshotCalendar);
        bumpDataVersion();
        show(`Не удалось удалить: ${String(e)}`, "error");
      }
    },
    [show],
  );

  const requestDelete = useCallback((id: number) => setConfirmId(id), []);
  const closeSheet = useCallback(() => setSheet(null), []);
  const closeConfirm = useCallback(() => setConfirmId(null), []);

  return (
    <Context.Provider value={ctx}>
      {children}

      <PersonSheet
        state={sheet}
        onStartEdit={startEdit}
        onCreate={doCreate}
        onUpdate={doUpdate}
        onDelete={requestDelete}
        onClose={closeSheet}
      />

      <ConfirmDialog
        open={confirmId !== null}
        message="Удалить этого человека? Действие необратимо."
        onConfirm={() => confirmId !== null && doDelete(confirmId)}
        onClose={closeConfirm}
      />
    </Context.Provider>
  );
}
