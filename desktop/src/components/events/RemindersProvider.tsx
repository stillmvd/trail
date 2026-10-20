import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { listen } from "@tauri-apps/api/event";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { bumpDataVersion } from "@/lib/dataVersion";
import { modeStore } from "@/lib/mode";
import { snoozePlusHour } from "@/lib/reminders";
import { TIMELINE_MIN_DATE, TIMELINE_MAX_DATE, isValidISODate } from "@/lib/constants";
import {
  ReminderSheet,
  type ReminderSheetState,
} from "@/components/reminders/ReminderSheet";
import type { ReminderFormValues } from "@/components/reminders/ReminderForm";
import {
  createReminder,
  updateReminder,
  deleteReminder,
  completeReminder,
  snoozeReminder,
  clearCompleted,
  getReminder,
  type Reminder,
  type ReminderInput,
} from "@/db/queries/reminders";

type NotificationAction = { kind: "reminder" | "birthday" | "digest"; id: number; action: string };

type RemindersCtx = {
  addReminder: (input: ReminderInput) => Promise<boolean>;
  saveReminder: (id: number, input: ReminderInput) => Promise<boolean>;
  removeReminder: (id: number) => void;
  finishReminder: (id: number) => Promise<void>;
  postponeReminder: (id: number, untilISO: string) => Promise<void>;
  purgeCompleted: () => Promise<void>;
  openCreateReminder: (prefill?: Partial<ReminderFormValues>) => void;
  openEditReminder: (reminder: Reminder) => void;
};

const Context = createContext<RemindersCtx | null>(null);

export function useReminders() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useReminders must be used within RemindersProvider");
  return ctx;
}

function validate(input: ReminderInput): string | null {
  if (!input.title.trim()) return "Название не может быть пустым";
  if (!isValidISODate(input.date) || input.date < TIMELINE_MIN_DATE || input.date > TIMELINE_MAX_DATE)
    return "Некорректная дата";
  if (input.time !== null && !/^\d{2}:\d{2}$/.test(input.time)) return "Некорректное время";
  return null;
}

export function RemindersProvider({ children }: { children: ReactNode }) {
  const { show } = useToast();
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [sheet, setSheet] = useState<ReminderSheetState | null>(null);

  const openCreateReminder = useCallback(
    (prefill?: Partial<ReminderFormValues>) => setSheet({ mode: "create", prefill }),
    [],
  );
  const openEditReminder = useCallback(
    (reminder: Reminder) => setSheet({ mode: "edit", reminder }),
    [],
  );

  useEffect(() => {
    const unlisten = listen("add-reminder", () => {
      modeStore.set("reminders");
      setSheet({ mode: "create" });
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  useEffect(() => {
    const unlisten = listen<NotificationAction>("notification-action", async ({ payload }) => {
      if (payload.kind === "birthday") {
        modeStore.set("birthdays");
        return;
      }
      if (payload.kind === "digest") {
        modeStore.set("digest");
        return;
      }
      modeStore.set("reminders");
      if (payload.id <= 0) return;
      if (payload.action === "done") {
        await completeReminder(payload.id);
        bumpDataVersion();
        show("Напоминание выполнено", "success");
        return;
      }
      if (payload.action === "snooze") {
        await snoozeReminder(payload.id, snoozePlusHour());
        bumpDataVersion();
        show("Отложено на час", "success");
        return;
      }
      const reminder = await getReminder(payload.id);
      if (reminder) setSheet({ mode: "edit", reminder });
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [show]);

  const addReminder = useCallback(
    async (input: ReminderInput) => {
      const err = validate(input);
      if (err) {
        show(err, "error");
        return false;
      }
      await createReminder({ ...input, title: input.title.trim() });
      bumpDataVersion();
      show("Напоминание добавлено", "success");
      return true;
    },
    [show],
  );

  const saveReminder = useCallback(
    async (id: number, input: ReminderInput) => {
      const err = validate(input);
      if (err) {
        show(err, "error");
        return false;
      }
      await updateReminder(id, { ...input, title: input.title.trim() });
      bumpDataVersion();
      show("Изменения сохранены", "success");
      return true;
    },
    [show],
  );

  const removeReminder = useCallback((id: number) => setConfirmId(id), []);

  const finishReminder = useCallback(async (id: number) => {
    await completeReminder(id);
    bumpDataVersion();
  }, []);

  const postponeReminder = useCallback(async (id: number, untilISO: string) => {
    await snoozeReminder(id, untilISO);
    bumpDataVersion();
  }, []);

  const purgeCompleted = useCallback(async () => {
    await clearCompleted();
    bumpDataVersion();
  }, []);

  const doDelete = async (id: number) => {
    await deleteReminder(id);
    bumpDataVersion();
    show("Напоминание удалено", "success");
  };

  return (
    <Context.Provider
      value={{
        addReminder,
        saveReminder,
        removeReminder,
        finishReminder,
        postponeReminder,
        purgeCompleted,
        openCreateReminder,
        openEditReminder,
      }}
    >
      {children}

      <ReminderSheet
        state={sheet}
        onCreate={async (payload) => {
          if (await addReminder(payload)) setSheet(null);
        }}
        onUpdate={async (id, payload) => {
          if (await saveReminder(id, payload)) setSheet(null);
        }}
        onDelete={(id) => {
          setSheet(null);
          setConfirmId(id);
        }}
        onClose={() => setSheet(null)}
      />

      <ConfirmDialog
        open={confirmId !== null}
        message="Удалить это напоминание?"
        onConfirm={() => confirmId !== null && doDelete(confirmId)}
        onClose={() => setConfirmId(null)}
      />
    </Context.Provider>
  );
}
