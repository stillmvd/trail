import { differenceInCalendarDays, intervalToDuration, parseISO } from "date-fns";
import { todayISO } from "./dates";
import { upcomingAnniversary, unit, YEARS } from "./duration";

// Год при has_year=0 хранится фиктивным (2000): возраст и «сколько исполнится» скрыты,
// но дата ближайшего ДР считается корректно по дню и месяцу.

export function nextBirthdayISO(birthDateISO: string): string {
  return upcomingAnniversary(birthDateISO).iso;
}

export function daysUntilBirthday(birthDateISO: string): number {
  return differenceInCalendarDays(parseISO(nextBirthdayISO(birthDateISO)), parseISO(todayISO()));
}

export function isBirthdayToday(birthDateISO: string): boolean {
  return daysUntilBirthday(birthDateISO) === 0;
}

// Сколько исполнится в ближайший день рождения. null — если год рождения неизвестен.
export function turningAge(birthDateISO: string, hasYear: number): number | null {
  if (!hasYear) return null;
  return upcomingAnniversary(birthDateISO).ordinal;
}

export type AgeParts = { years: number; months: number; days: number };

export function currentAgeParts(birthDateISO: string, hasYear: number): AgeParts | null {
  if (!hasYear) return null;
  if (daysUntilBirthday(birthDateISO) === 0) return { years: upcomingAnniversary(birthDateISO).ordinal, months: 0, days: 0 };
  const d = intervalToDuration({ start: parseISO(birthDateISO), end: parseISO(todayISO()) });
  return { years: d.years ?? 0, months: d.months ?? 0, days: d.days ?? 0 };
}

export function formatTurningAge(birthDateISO: string, hasYear: number): string | null {
  const age = turningAge(birthDateISO, hasYear);
  return age === null ? null : unit(age, YEARS);
}
