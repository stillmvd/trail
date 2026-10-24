import { getDb } from "../database";
import { nextOccurrence, nowLocalMinuteISO, type RepeatKind, type RepeatUnit } from "@/lib/reminders";

export type Reminder = {
  id: number;
  title: string;
  note: string | null;
  date: string;
  time: string | null;
  repeat: RepeatKind;
  repeat_every: number | null;
  repeat_unit: RepeatUnit | null;
  pre_notify_min: number;
  nag: number;
  nag_interval_min: number | null;
  icon: string | null;
  color: string | null;
  event_id: number | null;
  snoozed_until: string | null;
  completed_at: string | null;
};

export type ReminderInput = {
  title: string;
  note: string | null;
  date: string;
  time: string | null;
  repeat: RepeatKind;
  repeatEvery: number | null;
  repeatUnit: RepeatUnit | null;
  preNotifyMin: number;
  nag: number;
  nagIntervalMin: number | null;
  icon: string | null;
  color: string | null;
  eventId: number | null;
};

const SELECT = `SELECT id, title, note, date, time, repeat, repeat_every, repeat_unit,
  pre_notify_min, nag, nag_interval_min, icon, color, event_id, snoozed_until, completed_at
  FROM reminders`;

export async function listReminders(): Promise<Reminder[]> {
  const db = await getDb();
  return db.select<Reminder[]>(`${SELECT} ORDER BY date, time IS NULL, time, id`);
}

export async function getReminder(id: number): Promise<Reminder | null> {
  const db = await getDb();
  const rows = await db.select<Reminder[]>(`${SELECT} WHERE id = ?`, [id]);
  return rows[0] ?? null;
}

export async function createReminder(input: ReminderInput): Promise<number> {
  const db = await getDb();
  const res = await db.execute(
    `INSERT INTO reminders(title, note, date, time, repeat, repeat_every, repeat_unit,
       pre_notify_min, nag, nag_interval_min, icon, color, event_id)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.title,
      input.note,
      input.date,
      input.time,
      input.repeat,
      input.repeatEvery,
      input.repeatUnit,
      input.preNotifyMin,
      input.nag,
      input.nagIntervalMin,
      input.icon,
      input.color,
      input.eventId,
    ],
  );
  return Number(res.lastInsertId);
}

export async function updateReminder(id: number, input: ReminderInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE reminders SET title = ?, note = ?, date = ?, time = ?, repeat = ?, repeat_every = ?,
       repeat_unit = ?, pre_notify_min = ?, nag = ?, nag_interval_min = ?, icon = ?, color = ?,
       event_id = ?, snoozed_until = NULL WHERE id = ?`,
    [
      input.title,
      input.note,
      input.date,
      input.time,
      input.repeat,
      input.repeatEvery,
      input.repeatUnit,
      input.preNotifyMin,
      input.nag,
      input.nagIntervalMin,
      input.icon,
      input.color,
      input.eventId,
      id,
    ],
  );
}

export async function deleteReminder(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM reminders WHERE id = ?", [id]);
}

// Разовое — фиксируем completed_at; повторяющееся — переносим date на следующее вхождение.
export async function completeReminder(id: number): Promise<void> {
  const reminder = await getReminder(id);
  if (!reminder) return;
  const db = await getDb();
  const now = nowLocalMinuteISO();
  if (reminder.repeat === "none") {
    await db.execute("UPDATE reminders SET completed_at = ?, snoozed_until = NULL WHERE id = ?", [
      now,
      id,
    ]);
    return;
  }
  const next = nextOccurrence(
    reminder.date,
    reminder.repeat,
    reminder.repeat_every,
    reminder.repeat_unit,
    now.slice(0, 10),
  );
  await db.execute("UPDATE reminders SET date = ?, snoozed_until = NULL WHERE id = ?", [
    next ?? reminder.date,
    id,
  ]);
}

export async function snoozeReminder(id: number, untilISO: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE reminders SET snoozed_until = ? WHERE id = ?", [untilISO, id]);
}

export async function clearCompleted(): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM reminders WHERE completed_at IS NOT NULL");
}
