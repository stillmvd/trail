import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { createLocalStore } from "./localStore";
import { todayISO, formatFullRu } from "./dates";
import { isBirthdayToday, formatTurningAge } from "./birthday";
import { nowLocalMinuteISO } from "./reminders";
import { listPeople } from "@/db/queries/people";
import { listReminders, type Reminder } from "@/db/queries/reminders";
import { getSetting, setSetting } from "@/db/queries/settings";

const LAST_NOTICE_KEY = "last_birthday_notice_date";
// v2: после пересоздания таблицы id напоминаний начинаются заново — старый ключ
// хранил отметки «уже уведомлено» с теми же id@date и глушил новые уведомления.
const REMINDER_STATE_KEY = "reminder_notice_state_v2";

// Приложение живёт в трее сутками: интервальная проверка переживает сон ПК, в отличие
// от одного таймера до полуночи. От дублей защищает отметка в settings, а не частота.
// Минутный шаг нужен напоминаниям («за 30 минут», назойливые каждые 10) — запрос в локальный SQLite дёшев.
const CHECK_INTERVAL_MS = 60 * 1000;

export const notifyBirthdaysStore = createLocalStore<"1" | "0">("trail.notifyBirthdays", "1");
export const notifyRemindersStore = createLocalStore<"1" | "0">("trail.notifyReminders", "1");

async function ensurePermission(): Promise<boolean> {
  if (await isPermissionGranted()) return true;
  return (await requestPermission()) === "granted";
}

type ToastButton = { label: string; action: string };

const REMINDER_BUTTONS: ToastButton[] = [
  { label: "Выполнено", action: "done" },
  { label: "Отложить на час", action: "snooze" },
];

// Родной WinRT-тост несёт кнопки и клик, плагин — нет. Если WinRT недоступен,
// падаем на плагин: лучше тост без действий, чем тишина.
export async function winToast(
  kind: "reminder" | "birthday" | "digest",
  id: number,
  title: string,
  body?: string,
  buttons: ToastButton[] = [],
): Promise<void> {
  try {
    await invoke("notify", { kind, id, title, body: body ?? null, buttons });
  } catch {
    if (await ensurePermission()) sendNotification({ title, body });
  }
}

// Отметка вида "2026-07-17:3,5" — дата и уже поздравленные. Дедуп по людям, а не по дате:
// иначе человек, добавленный после первой проверки, остался бы без уведомления до завтра.
function parseNotified(stored: string | null, today: string): Set<string> {
  const [date, ids] = (stored ?? "").split(":");
  if (date !== today || !ids) return new Set();
  return new Set(ids.split(","));
}

export async function checkBirthdays(): Promise<void> {
  if (notifyBirthdaysStore.get() !== "1") return;

  const today = todayISO();
  const born = (await listPeople()).filter((p) => isBirthdayToday(p.birth_date));
  if (born.length === 0) return;

  const notified = parseNotified(await getSetting(LAST_NOTICE_KEY), today);
  const fresh = born.filter((p) => !notified.has(String(p.id)));
  if (fresh.length === 0) return;

  for (const person of fresh) {
    const turning = formatTurningAge(person.birth_date, person.has_year);
    await winToast(
      "birthday",
      person.id,
      `Сегодня день рождения у ${person.name}`,
      turning ? `Исполняется ${turning}` : "С праздником!",
    );
  }

  const done = [...notified, ...fresh.map((p) => String(p.id))];
  await setSetting(LAST_NOTICE_KEY, `${today}:${done.join(",")}`);
}

// Ключи "<id>@<date>" и "pre:<id>@<date>" → момент последнего уведомления.
// Дата в ключе делает вхождение повторяющегося напоминания уникальным.
type ReminderNoticeState = Record<string, string>;

async function loadReminderState(): Promise<ReminderNoticeState> {
  try {
    return JSON.parse((await getSetting(REMINDER_STATE_KEY)) ?? "{}") as ReminderNoticeState;
  } catch {
    return {};
  }
}

function dueMoment(r: Reminder): string {
  const base = r.time ? `${r.date}T${r.time}` : `${r.date}T00:00`;
  return r.snoozed_until && r.snoozed_until > base ? r.snoozed_until : base;
}

const minutesBetween = (fromISO: string, untilISO: string): number =>
  (Date.parse(untilISO) - Date.parse(fromISO)) / 60000;

// «Через 10 мин / 2 ч / 3 дн» для предварительного оповещения.
function formatIn(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} ч`;
  return `${Math.round(minutes / 1440)} дн`;
}

export async function checkReminders(): Promise<void> {
  if (notifyRemindersStore.get() !== "1") return;

  const active = (await listReminders()).filter((r) => r.completed_at === null);
  const now = nowLocalMinuteISO();
  const today = now.slice(0, 10);
  const state = await loadReminderState();
  const next: ReminderNoticeState = {};
  const toasts: { id: number; title: string; body?: string }[] = [];
  const missed: { id: number; title: string }[] = [];

  // Окно уведомлений: от «за pre_notify_min до срока» и до отметки «выполнено».
  // Назойливый режим повторяет в обеих стадиях (до срока и после) со своим интервалом.
  for (const r of active) {
    const due = dueMoment(r);
    const dueKey = `${r.id}@${r.date}`;
    const preKey = `pre:${r.id}@${r.date}`;
    const nagInterval = r.nag === 1 ? (r.nag_interval_min ?? 30) : null;
    const minutesToDue = minutesBetween(now, due);

    if (minutesToDue <= 0) {
      const prev = state[dueKey];
      if (!prev) {
        if (due.slice(0, 10) < today) missed.push({ id: r.id, title: r.title });
        else toasts.push({ id: r.id, title: r.title, body: r.note ?? undefined });
        next[dueKey] = now;
      } else if (nagInterval !== null && minutesBetween(prev, now) >= nagInterval) {
        toasts.push({ id: r.id, title: r.title, body: r.note ?? undefined });
        next[dueKey] = now;
      } else {
        next[dueKey] = prev;
      }
    } else if (r.pre_notify_min > 0 && minutesToDue <= r.pre_notify_min) {
      const prev = state[preKey];
      const pre = {
        id: r.id,
        title: `Через ${formatIn(Math.round(minutesToDue))}: ${r.title}`,
        body: r.time ? `${formatFullRu(r.date)}, ${r.time}` : formatFullRu(r.date),
      };
      if (!prev) {
        toasts.push(pre);
        next[preKey] = now;
      } else if (nagInterval !== null && minutesBetween(prev, now) >= nagInterval) {
        toasts.push(pre);
        next[preKey] = now;
      } else {
        next[preKey] = prev;
      }
    }
  }

  const changed = JSON.stringify(next) !== JSON.stringify(state);

  if (missed.length > 3) {
    await winToast("reminder", 0, `Пропущено напоминаний: ${missed.length}`);
  } else {
    for (const m of missed) {
      await winToast("reminder", m.id, `Пропущено: ${m.title}`, undefined, REMINDER_BUTTONS);
    }
  }
  for (const t of toasts) {
    await winToast("reminder", t.id, t.title, t.body, REMINDER_BUTTONS);
  }
  if (changed) await setSetting(REMINDER_STATE_KEY, JSON.stringify(next));
}

export function useNotifications() {
  useEffect(() => {
    const run = () => {
      checkBirthdays().catch(() => {});
      checkReminders().catch(() => {});
    };
    run();
    const timer = setInterval(run, CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);
}
