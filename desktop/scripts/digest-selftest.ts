import assert from "node:assert/strict";
import {
  buildPrompt,
  capitalizeCyrillic,
  dedupe,
  extractJson,
  parseSelection,
  resolvePicks,
  topicsFromInterests,
  trimVerdict,
  withinWindow,
} from "../src/lib/digest/pick.ts";
import { emptyState, NOTHING_FRESH } from "../src/lib/digest/emptyState.ts";
import { groupDigest } from "../src/lib/digest/groups.ts";
import type { Digest, DigestEntry } from "../src/db/queries/digests.ts";

const fresh = dedupe(
  [
    { url: "https://a", title: "seen", source: "s" },
    { url: "https://b", title: "fresh", source: "s" },
    { url: "https://b", title: "dupe in batch", source: "s" },
  ],
  new Set(["https://a"]),
);
assert.equal(fresh.length, 1);
assert.equal(fresh[0].url, "https://b");

const kept = withinWindow(
  [
    { url: "https://x", title: "t", source: "s", date: new Date(Date.now() - 90 * 3600_000).toISOString() },
    { url: "https://y", title: "t", source: "s", date: new Date().toISOString() },
    { url: "https://z", title: "t", source: "s", date: null },
  ],
  26,
);
assert.equal(kept.length, 2);

assert.equal((extractJson('```json\n{"picks":[{"i":1}]}\n```') as { picks: { i: number }[] }).picks[0].i, 1);
assert.equal((extractJson('вот результат: {"picks":[]} готово') as { picks: unknown[] }).picks.length, 0);

const pool = [
  { url: "https://1", title: "Утечка памяти в Python", source: "Хабр" },
  { url: "https://2", title: "Семь ИИ-поисковиков, ноль общих источников", source: "HN" },
  { url: "https://3", title: "Новый Pixel получил чип", source: "The Verge" },
];
const resolved = resolvePicks(
  [
    { i: 1, t: "Утечка памяти в", why: "a" },
    { i: 0, t: "Семь ИИ-поисковиков, ноль", why: "b" },
    { i: 9, t: "нет такого заголовка", why: "c" },
    { i: 0, t: "Утечка памяти в", why: "дубль" },
  ],
  pool,
);
assert.equal(resolved.length, 2);
assert.equal(resolved[0].item.url, "https://1");
assert.equal(resolved[1].item.url, "https://2");

assert.equal(trimVerdict("Старт втрое быстрее, что важно для фронтенда"), "Старт втрое быстрее");
assert.ok(trimVerdict("Виноват аллокатор, лечится MALLOC_ARENA_MAX=2").includes("лечится"));
assert.equal(
  trimVerdict("Память тает из-за того, что позволяет кэшу расти"),
  "Память тает из-за того, что позволяет кэшу расти",
);
assert.equal(trimVerdict("Кэш живёт в памяти воркера — что демонстрирует подход"), "Кэш живёт в памяти воркера");

assert.equal(capitalizeCyrillic("расширение VS Code для корпоративной LLM"), "Расширение VS Code для корпоративной LLM");
assert.equal(capitalizeCyrillic("ёмкость батареи выросла"), "Ёмкость батареи выросла");
assert.equal(capitalizeCyrillic("iOS 26 наконец умеет"), "iOS 26 наконец умеет");
assert.equal(capitalizeCyrillic("npm сломал сборку"), "npm сломал сборку");
assert.equal(capitalizeCyrillic("8 минут вместо 28"), "8 минут вместо 28");
assert.equal(capitalizeCyrillic("Уже с заглавной"), "Уже с заглавной");
assert.equal(capitalizeCyrillic(""), "");

const cairnInterests = [
  "Фронтенд и TypeScript: React, сборка, производительность, инструменты разработчика",
  "AI и LLM: облачные модели, агенты, практические приёмы работы с API",
  "Инструменты для Claude Code: плагины, MCP-серверы, скиллы, хуки, интересные схемы использования",
  "Новинки гаджетов: телефоны, планшеты, наушники, носимое",
  "Любопытное и необычное: неожиданные инженерные истории, расследования, находки, хорошие лонгриды",
].join("\n");
const topics = topicsFromInterests(cairnInterests);
assert.deepEqual(topics, [
  "Фронтенд и TypeScript",
  "AI и LLM",
  "Инструменты для Claude Code",
  "Новинки гаджетов",
  "Любопытное и необычное",
]);
assert.deepEqual(topicsFromInterests("Машинное обучение без хайпа\nРемонт и дача"), [
  "Машинное обучение без",
  "Ремонт и дача",
  "Любопытное",
]);

const selection = parseSelection(
  JSON.stringify({
    picks: [
      { i: 0, t: "Утечка памяти в", why: "Виноват аллокатор, что важно для бэкенда", topic: "фронтенд и typescript" },
      { i: 1, t: "Семь ИИ-поисковиков, ноль", why: "b", topic: "Котики" },
      { i: 2, t: "Новый Pixel получил", why: "c", topic: "Новинки гаджетов" },
    ],
    near: [
      { i: 2, t: "Новый Pixel получил" },
      { i: 1, t: "Семь ИИ-поисковиков, ноль" },
    ],
  }),
  pool,
  2,
  topics,
);
assert.equal(selection.main.length, 2);
assert.equal(selection.main[0].topic, "Фронтенд и TypeScript");
assert.equal(selection.main[0].why, "Виноват аллокатор");
assert.equal(selection.main[1].topic, "Любопытное и необычное");
assert.deepEqual(
  selection.near.map((n) => n.url),
  ["https://3"],
);

const prompt = buildPrompt({
  interests: cairnInterests,
  avoid: "политика",
  maxItems: 12,
  liked: ["Хороший заголовок"],
  disliked: [],
  streaks: [{ source: "Пикабу", streak: 3 }],
  topics,
  candidates: pool,
});
assert.ok(prompt.includes("Раньше брал (лайки):\n- Хороший заголовок"));
assert.ok(!prompt.includes("Раньше отклонял"));
assert.ok(prompt.includes("- Пикабу: 3 отклонений подряд"));
assert.ok(prompt.includes("0. [Хабр] Утечка памяти в Python"));
assert.ok(prompt.includes("тему ровно из списка: Фронтенд и TypeScript, AI и LLM"));

const base = {
  today: "2026-10-20",
  now: new Date(2026, 9, 20, 10, 0).getTime(),
  hasToday: false,
  hasAny: true,
  hasKey: true,
  lastError: "",
  lastAttemptAt: null,
  attemptsToday: 0,
  config: { time: "09:00", windowHours: 26 },
};
assert.equal(emptyState({ ...base, hasToday: true }), null);
assert.equal(emptyState(base), null);
assert.equal(emptyState({ ...base, hasKey: false })?.kind, "nokey");
assert.equal(emptyState({ ...base, hasAny: false, now: new Date(2026, 9, 20, 8, 0).getTime() })?.text, "Первый сбор — сегодня в 9:00.");
const failedAt = new Date(2026, 9, 20, 9, 50).toISOString();
const failed = emptyState({ ...base, lastError: "Хабр: Failed to fetch", lastAttemptAt: failedAt, attemptsToday: 1 });
assert.equal(failed?.kind, "error");
assert.equal(failed?.text, "Хабр: Failed to fetch · повторю через 5 минут, попыток осталось 2");
const none = emptyState({ ...base, lastError: NOTHING_FRESH, lastAttemptAt: failedAt, attemptsToday: 3 });
assert.equal(none?.kind, "none");
assert.equal(none?.text, "За последние 26 часов источники не дали ничего нового. Следующий сбор — завтра в 9:00.");
const yesterday = new Date(2026, 9, 19, 23, 0).toISOString();
assert.equal(emptyState({ ...base, lastError: "x", lastAttemptAt: yesterday }), null);

const created = "2026-10-20T06:00:00.000Z";
const entry = (item_id: number, topic: string, position: number, added_at = created, opened_at: string | null = null) =>
  ({ item_id, topic, position, added_at, opened_at, tier: "main", reaction: null }) as unknown as DigestEntry;
const groups = groupDigest(
  { created_at: created } as unknown as Digest,
  [
    entry(1, "Любопытное", 0),
    entry(2, "AI и LLM", 2),
    entry(3, "AI и LLM", 1),
    entry(4, "AI и LLM", 3, "2026-10-20T11:30:00.000Z"),
    entry(5, "AI и LLM", 4, "2026-10-20T11:30:00.000Z", "2026-10-20T11:40:00.000Z"),
  ],
  ["AI и LLM", "Любопытное"],
);
assert.deepEqual(groups.map((g) => g.topic), ["AI и LLM", "Любопытное"]);
assert.deepEqual(groups[0].entries.map((e) => e.item_id), [3, 2, 4, 5]);
assert.equal(groups[0].fresh, 1);

console.log("digest selftest ok");
