import { addDays, addHours, addWeeks, addMonths, addYears, format, parseISO } from "date-fns";
import { toISO } from "./dates";

export type RepeatKind = "none" | "daily" | "weekly" | "monthly" | "yearly" | "custom";
export type RepeatUnit = "day" | "week";

export const REPEAT_OPTIONS: { value: RepeatKind; label: string }[] = [
  { value: "none", label: "Без повтора" },
  { value: "daily", label: "Ежедневно" },
  { value: "weekly", label: "Еженедельно" },
  { value: "monthly", label: "Ежемесячно" },
  { value: "yearly", label: "Ежегодно" },
  { value: "custom", label: "Каждые N…" },
];

export function nowLocalMinuteISO(): string {
  return format(new Date(), "yyyy-MM-dd'T'HH:mm");
}

export function snoozePlusHour(): string {
  return format(addHours(new Date(), 1), "yyyy-MM-dd'T'HH:mm");
}

export function snoozeEvening(): string {
  const now = new Date();
  const base = now.getHours() >= 19 ? addDays(now, 1) : now;
  return `${toISO(base)}T19:00`;
}

export function snoozeTomorrow(): string {
  return `${toISO(addDays(new Date(), 1))}T09:00`;
}

export function reminderFromEvent(e: { id: number; title: string; date: string }) {
  if (e.date >= toISO(new Date())) return { title: e.title, date: e.date, eventId: e.id };
  return { title: e.title, date: toISO(addDays(new Date(), 1)), time: "10:00", eventId: e.id };
}

// День, в котором напоминание фактически всплывает: snooze сдвигает его вперёд.
export function effectiveDateISO(r: { date: string; snoozed_until: string | null }): string {
  const snoozeDay = r.snoozed_until?.slice(0, 10);
  return snoozeDay && snoozeDay > r.date ? snoozeDay : r.date;
}

// Первое вхождение повтора строго позже afterISO; для разовых — null.
export function nextOccurrence(
  dateISO: string,
  repeat: RepeatKind,
  repeatEvery: number | null,
  repeatUnit: RepeatUnit | null,
  afterISO: string,
): string | null {
  if (repeat === "none") return null;
  const every = Math.max(1, repeatEvery ?? 1);
  const step = (d: Date): Date => {
    switch (repeat) {
      case "daily":
        return addDays(d, 1);
      case "weekly":
        return addWeeks(d, 1);
      case "monthly":
        return addMonths(d, 1);
      case "yearly":
        return addYears(d, 1);
      default:
        return repeatUnit === "week" ? addWeeks(d, every) : addDays(d, every);
    }
  };
  let d = parseISO(dateISO);
  const limit = afterISO > dateISO ? afterISO : dateISO;
  do {
    d = step(d);
  } while (toISO(d) <= limit);
  return toISO(d);
}
