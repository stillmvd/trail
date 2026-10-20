export type Candidate = {
  url: string;
  title: string;
  source: string;
  blurb?: string | null;
  date?: string | null;
};

export type PromptInput = {
  interests: string;
  avoid: string;
  maxItems: number;
  liked: string[];
  disliked: string[];
  streaks: { source: string; streak: number }[];
  topics: string[];
  candidates: Candidate[];
};

export type Selection<T> = {
  main: { item: T; why: string; topic: string }[];
  near: T[];
};

export const NEAR_LIMIT = 8;
const CURIOUS = "Любопытное";

export function clean(text: string | null | undefined): string {
  return (text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function normalize(text: string | null | undefined): string {
  return (text || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function withinWindow<T extends Candidate>(items: T[], hours: number, now = Date.now()): T[] {
  const cutoff = now - hours * 3600_000;
  return items.filter((item) => {
    if (!item.url || !item.title) return false;
    const stamp = Date.parse(item.date ?? "");
    return Number.isNaN(stamp) ? true : stamp >= cutoff;
  });
}

export function dedupe<T extends Candidate>(items: T[], seen: Set<string>): T[] {
  const out: T[] = [];
  const local = new Set<string>();
  for (const item of items) {
    if (seen.has(item.url) || local.has(item.url)) continue;
    local.add(item.url);
    out.push(item);
  }
  return out;
}

export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`в ответе модели нет JSON: ${text.slice(0, 200)}`);
  return JSON.parse(body.slice(start, end + 1));
}

const VERDICT_TAIL =
  /[,—-]\s*(?:что|чем|это)\s+(?:важно|полезно|актуально|интересно|ценно|критично|удобно|показательно|демонстриру[а-яё]*|показыва[а-яё]*|дела[а-яё]*|да[её]т|позволя[а-яё]*|помога[а-яё]*|облегча[а-яё]*|упроща[а-яё]*|усложня[а-яё]*|означа[а-яё]*)(?![а-яё])[\s\S]*$/iu;

export function trimVerdict(why: string | null | undefined): string {
  const cut = (why || "").replace(VERDICT_TAIL, "").trim();
  return /(?:^|\s)(?:того|том|тем|потому|так|для|о)$/iu.test(cut) ? (why || "").trim() : cut;
}

type RawPick = { i?: unknown; t?: unknown; why?: unknown; topic?: unknown };

export function resolvePicks<T extends Candidate>(
  picks: RawPick[],
  items: T[],
): { item: T; pick: RawPick }[] {
  const out: { item: T; pick: RawPick }[] = [];
  const taken = new Set<string>();
  for (const pick of picks) {
    const echo = normalize(typeof pick.t === "string" ? pick.t : "").slice(0, 20);
    const guess = typeof pick.i === "number" ? items[pick.i] : undefined;
    const item =
      guess && (!echo || normalize(guess.title).startsWith(echo))
        ? guess
        : items.find((candidate) => echo && normalize(candidate.title).startsWith(echo));
    if (!item || taken.has(item.url)) continue;
    taken.add(item.url);
    out.push({ item, pick });
  }
  return out;
}

export function lines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*[-•]\s*/, "").trim())
    .filter(Boolean);
}

const firstWord = (text: string) => normalize(text).split(" ")[0] ?? "";

const TOPIC_MAX = 28;

function clipWords(text: string, max: number): string {
  if (text.length <= max) return text;
  const words = text.split(/\s+/);
  let out = words[0].slice(0, max);
  for (const word of words.slice(1)) {
    if (out.length + 1 + word.length > max) break;
    out += ` ${word}`;
  }
  return out;
}

export function topicsFromInterests(interests: string): string[] {
  const out: string[] = [];
  for (const line of lines(interests)) {
    const colon = line.indexOf(":");
    const head = colon > 0 ? line.slice(0, colon) : line.split(/\s+/).slice(0, 3).join(" ");
    const label = clipWords(head.trim(), TOPIC_MAX);
    if (label && !out.some((t) => normalize(t) === normalize(label))) out.push(label);
  }
  if (!out.some((t) => firstWord(t) === firstWord(CURIOUS))) out.push(CURIOUS);
  return out;
}

export function buildPrompt(input: PromptInput): string {
  const listing = input.candidates
    .map((item, i) => `${i}. [${item.source}] ${item.title}${item.blurb ? ` — ${item.blurb}` : ""}`)
    .join("\n");
  const bullets = (items: string[]) => items.map((x) => `- ${x}`).join("\n");

  const memory: string[] = [];
  if (input.liked.length) memory.push(`Раньше брал (лайки):\n${bullets(input.liked)}`);
  if (input.disliked.length) memory.push(`Раньше отклонял (дизлайки):\n${bullets(input.disliked)}`);
  if (input.streaks.length) {
    memory.push(
      `Источники, которые подряд отклонял — бери оттуда только очень сильное:\n${bullets(
        input.streaks.map((s) => `${s.source}: ${s.streak} отклонений подряд`),
      )}`,
    );
  }

  return `Ты — редактор персонального дайджеста. Читатель — senior fullstack разработчик.

Его интересы:
${bullets(lines(input.interests))}

Не берёт:
${bullets(lines(input.avoid))}
${memory.length ? `\n${memory.join("\n\n")}\n` : ""}
Ниже ${input.candidates.length} материалов за сутки. Отбери максимум ${input.maxItems} самых стоящих.
Лучше вернуть 4 отличных, чем 12 средних. Если ничего стоящего нет — верни пустой список.
Порядок — от самого интересного.

Ровно один-два пункта отдай под просто любопытное — необычную историю, находку, странный
инженерный трюк (Пикабу, нетипичные статьи Хабра). Эти места зарезервированы: не отдавай
их технической повестке, даже если та выглядит важнее. Остальное — строго по интересам.

Поле why — одна фраза по-русски, которая добавляет к заголовку то, чего в нём нет:
цифру, вывод, механизм, неожиданный поворот. Три жёстких запрета:
1. Не пересказывай заголовок другими словами — это пустая строка.
2. Никаких хвостов через запятую со словом «что»: «..., что важно для...»,
   «..., что полезно для...», «..., что актуально для...», «..., что демонстрирует...»,
   «..., что интересно...» и любых их вариантов. Фраза кончается фактом, а не выводом
   о пользе. Зачем это читателю — он поймёт сам.
3. Не начинай с глагола про сам материал: «показывает», «рассказывает», «объясняет»,
   «демонстрирует», «рассуждает», «сравнивает», «поднимает проблему», «разбирает».
   Начинай сразу с сути — с того, о чём материал, а не с того, что он делает.
Плохо (пересказ): заголовок «Утечка памяти в Python» → «Про утечку памяти в Python»
Плохо (хвост): «Разбор нового рантайма, что важно для фронтенд-разработки»
Плохо (глагол): «Объясняет, почему растёт RSS при спокойном tracemalloc»
Хорошо: «Виноват фрагментированный arena-аллокатор, лечится MALLOC_ARENA_MAX=2»
Фразы в выпуске должны быть разными по построению — не лепи их по одному шаблону.
Если добавить нечего — материал не стоит места в дайджесте, не бери его.

Каждому пункту дай тему ровно из списка: ${input.topics.join(", ")}.
Отдельно перечисли до ${NEAR_LIMIT} материалов, которые почти взял, — без why.

Верни строго JSON без пояснений:
{"picks":[{"i":<номер>,"t":"<первые 4 слова заголовка дословно>","why":"<одна фраза>","topic":"<тема>"}],
 "near":[{"i":<номер>,"t":"<первые 4 слова заголовка дословно>"}]}

Материалы:
${listing}`;
}

export function parseSelection<T extends Candidate>(
  text: string,
  candidates: T[],
  maxItems: number,
  topics: string[],
): Selection<T> {
  const parsed = extractJson(text) as { picks?: RawPick[]; near?: RawPick[] };
  const fallback = topics[topics.length - 1] ?? CURIOUS;
  const main = resolvePicks(Array.isArray(parsed.picks) ? parsed.picks : [], candidates)
    .slice(0, maxItems)
    .map(({ item, pick }) => {
      const topic = typeof pick.topic === "string" ? pick.topic.trim() : "";
      const known = topics.find((t) => normalize(t) === normalize(topic));
      return { item, why: trimVerdict(typeof pick.why === "string" ? pick.why : ""), topic: known ?? fallback };
    });
  const taken = new Set(main.map((m) => m.item.url));
  const near = resolvePicks(Array.isArray(parsed.near) ? parsed.near : [], candidates)
    .map(({ item }) => item)
    .filter((item) => !taken.has(item.url))
    .slice(0, NEAR_LIMIT);
  return { main, near };
}
