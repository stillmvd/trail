import { format } from "date-fns";
import type { DigestConfig } from "./config";

export const RETRY_AFTER_MS = 15 * 60 * 1000;
export const MAX_ATTEMPTS = 3;

export const NOTHING_FRESH = "Свежего ничего не нашлось";
export const NOTHING_PICKED = "Модель не нашла ничего стоящего";

export type EmptyKind = "error" | "none" | "nokey" | "pending";
export type EmptyState = { kind: EmptyKind; title: string; text: string; action: string };

export type EmptyInput = {
  today: string;
  now: number;
  hasToday: boolean;
  hasAny: boolean;
  hasKey: boolean;
  lastError: string;
  lastAttemptAt: string | null;
  attemptsToday: number;
  config: Pick<DigestConfig, "time" | "windowHours">;
};

const MINUTES: [string, string, string] = ["минуту", "минуты", "минут"];
const HOURS: [string, string, string] = ["час", "часа", "часов"];

function pluralRu(n: number, [one, few, many]: [string, string, string]): string {
  const abs = n % 100;
  const tail = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (tail > 1 && tail < 5) return few;
  return tail === 1 ? one : many;
}

export function emptyState(input: EmptyInput): EmptyState | null {
  if (input.hasToday) return null;
  const time = input.config.time.replace(/^0/, "");

  if (!input.hasKey) {
    return {
      kind: "nokey",
      title: "Нужен ключ OpenRouter",
      text: "Отбор делает модель, без ключа сводка не собирается. Ключ вводится в настройках раздела.",
      action: "Открыть настройки",
    };
  }

  const attemptMs = input.lastAttemptAt ? Date.parse(input.lastAttemptAt) : NaN;
  const failedToday =
    input.lastError !== "" && !Number.isNaN(attemptMs) && format(new Date(attemptMs), "yyyy-MM-dd") === input.today;

  if (!failedToday) {
    if (input.hasAny) return null;
    const before = format(new Date(input.now), "HH:mm") < input.config.time;
    return {
      kind: "pending",
      title: "Сводки ещё нет",
      text: before ? `Первый сбор — сегодня в ${time}.` : "Сбор вот-вот начнётся.",
      action: "Собрать сейчас",
    };
  }

  const left = MAX_ATTEMPTS - input.attemptsToday;
  const minutes = Math.max(1, Math.ceil((attemptMs + RETRY_AFTER_MS - input.now) / 60_000));
  const retryIn = `через ${minutes} ${pluralRu(minutes, MINUTES)}`;

  if (input.lastError === NOTHING_FRESH || input.lastError === NOTHING_PICKED) {
    const hours = input.config.windowHours;
    const why =
      input.lastError === NOTHING_FRESH
        ? `За последние ${hours} ${pluralRu(hours, HOURS)} источники не дали ничего нового.`
        : "Модель не нашла среди свежего ничего стоящего.";
    return {
      kind: "none",
      title: NOTHING_FRESH,
      text: `${why} Следующий сбор — ${left > 0 ? retryIn : `завтра в ${time}`}.`,
      action: "Собрать ещё раз",
    };
  }

  return {
    kind: "error",
    title: "Сбор не удался",
    text:
      left > 0
        ? `${input.lastError} · повторю ${retryIn}, попыток осталось ${left}`
        : `${input.lastError} · попытки на сегодня кончились, следующий сбор — завтра в ${time}`,
    action: "Повторить сейчас",
  };
}
