import { fetch } from "@tauri-apps/plugin-http";
import { clean } from "./pick";

export type Fetched = {
  url: string;
  title: string;
  source: string;
  date: string | null;
  blurb: string | null;
  imageUrl: string | null;
};

export const BOT_UA = "digest-bot/1.0 (personal use)";
export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const TIMEOUT_MS = 20_000;

const SOURCE_NAMES: Record<string, string> = { "habr.com": "Хабр", "pikabu.ru": "Пикабу" };

async function request<T>(
  url: string,
  { userAgent, accept, timeoutMs = TIMEOUT_MS }: { userAgent: string; accept?: string; timeoutMs?: number },
  read: (res: Response) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": userAgent, ...(accept ? { accept } : {}) },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`.trim());
    return await read(res);
  } finally {
    clearTimeout(timer);
  }
}

async function getText(url: string, userAgent: string, encoding?: string | null) {
  return request(url, { userAgent }, async (res) => new TextDecoder(encoding || "utf-8").decode(await res.arrayBuffer()));
}

async function getJson<T>(url: string): Promise<T> {
  return request(url, { userAgent: BOT_UA, accept: "application/json" }, (res) => res.json() as Promise<T>);
}

function textOf(html: string | null | undefined): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return clean(doc.body?.textContent ?? "");
}

function child(el: Element, name: string): Element | null {
  return el.getElementsByTagName(name)[0] ?? null;
}

function childText(el: Element, ...names: string[]): string {
  for (const name of names) {
    const value = child(el, name)?.textContent?.trim();
    if (value) return value;
  }
  return "";
}

function imageOf(el: Element): string | null {
  const enclosure = [...el.getElementsByTagName("enclosure")].find((e) =>
    (e.getAttribute("type") ?? "").startsWith("image/"),
  );
  const media = child(el, "media:content") ?? child(el, "media:thumbnail");
  return enclosure?.getAttribute("url") || media?.getAttribute("url") || null;
}

function atomLink(entry: Element): string {
  const links = [...entry.getElementsByTagName("link")];
  const alternate = links.find((l) => (l.getAttribute("rel") ?? "alternate") === "alternate") ?? links[0];
  return alternate?.getAttribute("href") ?? "";
}

function toIso(value: string): string | null {
  const stamp = Date.parse(value);
  return Number.isNaN(stamp) ? null : new Date(stamp).toISOString();
}

export function parseFeed(xml: string): { title: string; items: Omit<Fetched, "source">[] } {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("лента не разбирается как XML");
  const channel = child(doc.documentElement, "channel");
  if (channel || doc.documentElement.nodeName === "rss") {
    const root = channel ?? doc.documentElement;
    return {
      title: textOf(childText(root, "title")),
      items: [...doc.getElementsByTagName("item")].map((item) => ({
        title: textOf(childText(item, "title")),
        url: childText(item, "link", "guid"),
        date: toIso(childText(item, "pubDate", "dc:date")),
        blurb: textOf(childText(item, "description", "content:encoded")).slice(0, 280) || null,
        imageUrl: imageOf(item),
      })),
    };
  }
  return {
    title: textOf(childText(doc.documentElement, "title")),
    items: [...doc.getElementsByTagName("entry")].map((entry) => ({
      title: textOf(childText(entry, "title")),
      url: atomLink(entry),
      date: toIso(childText(entry, "published", "updated")),
      blurb: textOf(childText(entry, "summary", "content")).slice(0, 280) || null,
      imageUrl: imageOf(entry),
    })),
  };
}

export async function fromRss(url: string, encoding: string | null): Promise<Fetched[]> {
  const feed = parseFeed(await getText(url, encoding ? BROWSER_UA : BOT_UA, encoding));
  const host = new URL(url).hostname.replace(/^www\./, "");
  const source = SOURCE_NAMES[host] || feed.title || host;
  return feed.items.filter((i) => i.url && i.title).map((i) => ({ ...i, source }));
}

type HnHit = {
  title: string;
  url?: string;
  objectID: string;
  created_at: string;
  points: number;
  num_comments: number;
};

export async function fromHackerNews(minPoints: number): Promise<Fetched[]> {
  const data = await getJson<{ hits?: HnHit[] }>(
    `https://hn.algolia.com/api/v1/search?tags=front_page&numericFilters=points>${minPoints}`,
  );
  return (data.hits ?? []).map((hit) => ({
    title: clean(hit.title),
    url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
    source: "Hacker News",
    date: toIso(hit.created_at),
    blurb: `${hit.points} points, ${hit.num_comments} comments`,
    imageUrl: null,
  }));
}

export async function fromReddit(subs: string[], take: number): Promise<Fetched[]> {
  const feed = parseFeed(await getText(`https://www.reddit.com/r/${subs.join("+")}/top.rss?t=day`, BROWSER_UA));
  return feed.items
    .filter((i) => i.url && i.title)
    .slice(0, take)
    .map((i) => ({ ...i, source: `r/${i.url.match(/reddit\.com\/r\/([^/]+)\//)?.[1] ?? "reddit"}` }));
}

type GithubRelease = { tag_name: string; html_url: string; published_at: string; body?: string };

export async function fromGithub(repo: string): Promise<Fetched[]> {
  const release = await getJson<GithubRelease>(`https://api.github.com/repos/${repo}/releases/latest`);
  return [
    {
      title: `${repo} ${release.tag_name}`,
      url: release.html_url,
      source: "GitHub",
      date: toIso(release.published_at),
      blurb: clean(release.body).slice(0, 400) || null,
      imageUrl: null,
    },
  ];
}

export async function pageText(url: string, timeoutMs: number): Promise<string> {
  return request(url, { userAgent: BROWSER_UA, timeoutMs }, (res) => res.text());
}

export async function download(url: string, timeoutMs: number): Promise<{ bytes: Uint8Array; type: string }> {
  return request(url, { userAgent: BROWSER_UA, timeoutMs }, async (res) => ({
    bytes: new Uint8Array(await res.arrayBuffer()),
    type: res.headers.get("content-type") ?? "",
  }));
}
