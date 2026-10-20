import { format } from "date-fns";
import type { Digest, DigestEntry } from "@/db/queries/digests";

export type DigestGroup = { key: string; title: string; entries: DigestEntry[] };

const APPEND_GAP_MS = 60_000;

const byPosition = (a: DigestEntry, b: DigestEntry) => a.position - b.position;

export function groupDigest(digest: Digest, entries: DigestEntry[], topics: string[]): DigestGroup[] {
  const createdMs = new Date(digest.created_at).getTime();
  const base = new Map<string, DigestEntry[]>();
  const appended = new Map<string, DigestEntry[]>();

  for (const e of entries) {
    if (e.tier !== "main") continue;
    if (new Date(e.added_at).getTime() - createdMs > APPEND_GAP_MS) {
      appended.set(e.added_at, [...(appended.get(e.added_at) ?? []), e]);
    } else {
      const topic = e.topic ?? "";
      base.set(topic, [...(base.get(topic) ?? []), e]);
    }
  }

  const rank = (topic: string) => {
    const i = topics.indexOf(topic);
    return i === -1 ? topics.length - 0.5 : i;
  };
  const groups: DigestGroup[] = [...base.keys()]
    .sort((a, b) => rank(a) - rank(b))
    .map((topic) => ({ key: `t:${topic}`, title: topic || "Без темы", entries: base.get(topic)!.sort(byPosition) }));

  for (const addedAt of [...appended.keys()].sort()) {
    groups.push({
      key: `a:${addedAt}`,
      title: `Добавлено в ${format(new Date(addedAt), "HH:mm")}`,
      entries: appended.get(addedAt)!.sort(byPosition),
    });
  }
  return groups;
}
