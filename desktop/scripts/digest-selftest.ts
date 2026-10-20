import assert from "node:assert/strict";
import {
  buildPrompt,
  dedupe,
  extractJson,
  parseSelection,
  resolvePicks,
  topicsFromInterests,
  trimVerdict,
  withinWindow,
} from "../src/lib/digest/pick.ts";

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

console.log("digest selftest ok");
