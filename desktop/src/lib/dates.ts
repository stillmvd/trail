import { format, parseISO, isValid } from "date-fns";
import { ru } from "date-fns/locale";

export const ISO_DATE = "yyyy-MM-dd";

const pad = (n: number) => String(n).padStart(2, "0");

export function todayISO(): string {
  return format(new Date(), ISO_DATE);
}

/** ISO 'YYYY-MM-DD' → миллисекунды UTC-полуночи (стабильная ось без DST-сдвигов). */
export function isoToMs(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Миллисекунды → ISO 'YYYY-MM-DD' (по UTC). */
export function msToISO(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDaysISO(iso: string, days: number): string {
  return msToISO(isoToMs(iso) + days * 86_400_000);
}

const WORDS: Record<string, number> = { позавчера: -2, вчера: -1, сегодня: 0, завтра: 1, послезавтра: 2 };

export function parseTypedDate(input: string): string | null {
  const s = input.trim().toLowerCase().replace(/ё/g, "е");
  if (!s) return null;
  if (s.length >= 3) {
    const word = Object.keys(WORDS).find((w) => w.startsWith(s));
    if (word) return addDaysISO(todayISO(), WORDS[word]);
  }
  const m = /^(\d{1,2})[.,/\s-](\d{1,2})(?:[.,/\s-](\d{2}|\d{4}))?$/.exec(s);
  if (!m) return null;
  const now = new Date();
  let year = m[3] ? Number(m[3]) : now.getFullYear();
  if (m[3]?.length === 2) year += year <= (now.getFullYear() % 100) + 15 ? 2000 : 1900;
  const iso = `${year}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  return isValid(parseISO(iso)) && toISO(iso) === iso ? iso : null;
}

export function toISO(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, ISO_DATE);
}

export function formatRu(date: Date | string, pattern = "d MMMM yyyy"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "";
  return format(d, pattern, { locale: ru });
}

export const formatFullRu = (date: Date | string) => formatRu(date, "d MMMM yyyy");
export const formatDayMonthRu = (date: Date | string) => formatRu(date, "d MMM");
export const formatMonthShortRu = (date: Date | string) => formatRu(date, "LLL");
export const formatMonthRu = (date: Date | string) => formatRu(date, "LLLL yyyy");
export const formatWeekdayShortRu = (date: Date | string) => formatRu(date, "EEEEEE");
export const formatWeekdayFullRu = (date: Date | string) => formatRu(date, "EEEE");
export const formatYear = (date: Date | string) => formatRu(date, "yyyy");
export const formatDayNum = (date: Date | string) => formatRu(date, "d");
