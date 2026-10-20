import { getSetting, setSetting } from "@/db/queries/settings";
import { createSource } from "@/db/queries/digestSources";
import { importSeenUrls } from "@/db/queries/digestItems";
import { foreignKeysEnabled } from "@/db/queries/digests";
import { saveDigestConfig, STATE_KEYS } from "./config";
import seed from "./cairn-seed.json";

type RssEntry = string | { url: string; encoding?: string };

type CairnSeed = {
  sources: {
    windowHours: number;
    maxItems: number;
    interests: string[];
    avoid: string[];
    rss: RssEntry[];
    reddit: { subs: string[]; take: number };
    github: string[];
    hackerNewsMinPoints: number;
  };
  seen: string[];
};

let seeding: Promise<void> | null = null;

async function seedOnce(): Promise<void> {
  if (import.meta.env.DEV) console.info("[digest] PRAGMA foreign_keys =", await foreignKeysEnabled());
  if ((await getSetting(STATE_KEYS.seeded)) === "1") return;
  const { sources, seen } = seed as CairnSeed;

  for (const entry of sources.rss) {
    const { url, encoding } = typeof entry === "string" ? { url: entry, encoding: undefined } : entry;
    await createSource({ kind: "rss", value: url, encoding: encoding ?? null });
  }
  for (const sub of sources.reddit.subs) await createSource({ kind: "reddit", value: sub });
  for (const repo of sources.github) await createSource({ kind: "github", value: repo });
  await createSource({ kind: "hn", value: "front_page", title: "Hacker News" });

  await saveDigestConfig({
    interests: sources.interests.join("\n"),
    avoid: sources.avoid.join("\n"),
    maxItems: sources.maxItems,
    windowHours: sources.windowHours,
    hnMinPoints: sources.hackerNewsMinPoints,
    redditTake: sources.reddit.take,
  });
  await importSeenUrls(seen, new Date().toISOString());
  await setSetting(STATE_KEYS.seeded, "1");
}

export function ensureSeeded(): Promise<void> {
  seeding ??= seedOnce().catch((e) => {
    seeding = null;
    throw e;
  });
  return seeding;
}
