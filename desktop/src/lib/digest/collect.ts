import { getSetting, setSetting } from "@/db/queries/settings";
import { listSources, markKindError, markKindOk, markSourceError, markSourceOk } from "@/db/queries/digestSources";
import { domainOf, freshCandidates, insertCandidates, type CandidateInput } from "@/db/queries/digestItems";
import { appendToDigest, createDigest, digestItemIds, getDigestByDate, type DigestEntryInput } from "@/db/queries/digests";
import { dislikeStreaksBySource, recentReactions } from "@/db/queries/digestReactions";
import { todayISO } from "../dates";
import { winToast } from "../notifications";
import { OPENROUTER_CHAT_URL, openRouterKeyStore, postJson } from "../openrouter";
import { loadDigestConfig, STATE_KEYS } from "./config";
import { buildPrompt, dedupe, parseSelection, topicsFromInterests } from "./pick";
import { settleLimited } from "./limit";
import { NOTHING_FRESH, NOTHING_PICKED } from "./emptyState";
import { fetchPreviews } from "./previews";
import { pruneDigest } from "./prune";
import { ensureSeeded } from "./seed";
import { fromGithub, fromHackerNews, fromReddit, fromRss, type Fetched } from "./sources";
import { bumpDigestVersion, DEFAULT_DIGEST_MODEL, digestModelStore, digestRunStore, digestUnseenStore, notifyDigestStore } from "./stores";

export type CollectResult =
  | { kind: "created" | "appended"; digestId: number; added: number }
  | { kind: "empty"; message: string }
  | { kind: "error"; message: string }
  | { kind: "busy" };

export const NO_KEY_MESSAGE = "Нет ключа OpenRouter";

let running = false;

type Job = { run: () => Promise<Fetched[]>; ok: (n: number) => Promise<void>; fail: (m: string) => Promise<void> };

const PARALLEL_SOURCES = 4;

const mark = (label: string, since: number) => {
  if (import.meta.env.DEV) console.info(`[digest] ${label}: ${Math.round(performance.now() - since)} ms`);
};

async function gather(hnMinPoints: number, redditTake: number): Promise<CandidateInput[]> {
  const sources = (await listSources()).filter((s) => s.enabled === 1);
  const jobs: { sourceId: number | null; job: Job }[] = [];
  for (const s of sources) {
    const ok = (n: number) => markSourceOk(s.id, n);
    const fail = (m: string) => markSourceError(s.id, m);
    if (s.kind === "rss") jobs.push({ sourceId: s.id, job: { run: () => fromRss(s.value, s.encoding), ok, fail } });
    if (s.kind === "github") jobs.push({ sourceId: s.id, job: { run: () => fromGithub(s.value), ok, fail } });
    if (s.kind === "hn") jobs.push({ sourceId: s.id, job: { run: () => fromHackerNews(hnMinPoints), ok, fail } });
  }
  const subs = sources.filter((s) => s.kind === "reddit").map((s) => s.value);
  if (subs.length) {
    jobs.push({
      sourceId: null,
      job: {
        run: () => fromReddit(subs, redditTake),
        ok: (n) => markKindOk("reddit", n),
        fail: (m) => markKindError("reddit", m),
      },
    });
  }

  const settled = await settleLimited(
    jobs.map(({ job }) => job.run),
    PARALLEL_SOURCES,
  );
  const items: CandidateInput[] = [];
  for (const [i, result] of settled.entries()) {
    const { sourceId, job } = jobs[i];
    if (result.status === "fulfilled") {
      await job.ok(result.value.length);
      for (const f of result.value) {
        items.push({
          url: f.url,
          title: f.title,
          source: f.source,
          sourceId,
          domain: domainOf(f.url),
          publishedAt: f.date,
          blurb: f.blurb,
          imageUrl: f.imageUrl,
        });
      }
    } else {
      await job.fail(result.reason instanceof Error ? result.reason.message : String(result.reason));
    }
  }
  return dedupe(items, new Set());
}

async function recordFailure(message: string, manual: boolean, countAttempt: boolean) {
  const now = new Date().toISOString();
  await setSetting(STATE_KEYS.lastAttemptAt, now);
  await setSetting(STATE_KEYS.lastError, message);
  if (!manual && countAttempt) {
    const today = todayISO();
    const sameDay = (await getSetting(STATE_KEYS.attemptsDate)) === today;
    const count = sameDay ? Number((await getSetting(STATE_KEYS.attemptsCount)) ?? 0) : 0;
    await setSetting(STATE_KEYS.attemptsDate, today);
    await setSetting(STATE_KEYS.attemptsCount, String(count + 1));
  }
  digestRunStore.set({ state: "error", message });
}

export async function refreshUnseen(): Promise<void> {
  const digest = await getDigestByDate(todayISO());
  digestUnseenStore.set(Boolean(digest && digest.viewed_at === null && digest.main_count > 0));
}

async function run(manual: boolean): Promise<CollectResult> {
  const key = openRouterKeyStore.get().trim();
  if (!key) {
    await recordFailure(NO_KEY_MESSAGE, manual, false);
    return { kind: "error", message: NO_KEY_MESSAGE };
  }
  await ensureSeeded();
  const config = await loadDigestConfig();
  const foundAt = new Date().toISOString();
  let since = performance.now();
  await insertCandidates(await gather(config.hnMinPoints, config.redditTake), foundAt);
  mark("источники", since);

  const today = todayISO();
  const existing = await getDigestByDate(today);
  const inDigest = new Set(existing ? await digestItemIds(existing.id) : []);
  const candidates = (
    await freshCandidates({
      foundAfter: await getSetting(STATE_KEYS.lastSuccessAt),
      windowStart: new Date(Date.now() - config.windowHours * 3600_000).toISOString(),
    })
  ).filter((c) => !inDigest.has(c.id));

  if (candidates.length === 0) {
    const message = existing ? "Нового не нашлось" : NOTHING_FRESH;
    if (existing) {
      await setSetting(STATE_KEYS.lastError, "");
      digestRunStore.set({ state: "idle" });
    } else {
      await recordFailure(message, manual, true);
    }
    return { kind: "empty", message };
  }

  const [{ liked, disliked }, streaks] = await Promise.all([recentReactions(15), dislikeStreaksBySource(3)]);
  const topics = topicsFromInterests(config.interests);
  const prompt = buildPrompt({
    interests: config.interests,
    avoid: config.avoid,
    maxItems: config.maxItems,
    liked,
    disliked,
    streaks,
    topics,
    candidates,
  });
  if (import.meta.env.DEV) console.info("[digest] prompt\n" + prompt);

  const model = digestModelStore.get().trim() || DEFAULT_DIGEST_MODEL;
  since = performance.now();
  const reply = await postJson(OPENROUTER_CHAT_URL, key, {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  });
  mark("модель", since);
  const text = reply?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("Модель не ответила текстом");
  const selection = parseSelection(text, candidates, config.maxItems, topics);
  await setSetting(STATE_KEYS.lastSuccessAt, foundAt);

  const main: DigestEntryInput[] = selection.main.map((m, position) => ({
    itemId: m.item.id,
    tier: "main",
    topic: m.topic,
    why: m.why,
    position,
  }));
  const near: DigestEntryInput[] = selection.near.map((item, position) => ({
    itemId: item.id,
    tier: "near",
    topic: null,
    why: null,
    position,
  }));

  if (!existing && main.length === 0) {
    const message = NOTHING_PICKED;
    await recordFailure(message, manual, true);
    return { kind: "empty", message };
  }

  let result: CollectResult;
  if (existing) {
    const added = await appendToDigest({ digestId: existing.id, candidates: candidates.length, main, near });
    result = { kind: "appended", digestId: existing.id, added };
  } else {
    const digestId = await createDigest({ date: today, model, candidates: candidates.length, entries: [...main, ...near] });
    result = { kind: "created", digestId, added: main.length };
  }

  since = performance.now();
  await fetchPreviews(selection.main.map((m) => m.item));
  mark("превью", since);
  await pruneDigest(config).catch((e) => {
    if (import.meta.env.DEV) console.warn("[digest] чистка", e);
  });
  await setSetting(STATE_KEYS.lastAttemptAt, new Date().toISOString());
  await setSetting(STATE_KEYS.lastError, "");
  digestRunStore.set({ state: "idle" });
  await refreshUnseen();
  bumpDigestVersion();

  if (notifyDigestStore.get() === "1" && result.added > 0) {
    const body = result.kind === "created" ? `${result.added} материалов` : `Добавлено в сводку: ${result.added}`;
    await winToast("digest", result.digestId, "Сводка готова", body);
  }
  return result;
}

export async function collectDigest({ manual }: { manual: boolean }): Promise<CollectResult> {
  if (running) return { kind: "busy" };
  running = true;
  digestRunStore.set({ state: "running" });
  try {
    return await run(manual);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await recordFailure(message, manual, true).catch(() => {});
    return { kind: "error", message };
  } finally {
    running = false;
    if (digestRunStore.get().state === "running") digestRunStore.set({ state: "idle" });
  }
}

export function isCollecting(): boolean {
  return running;
}
