import type { Digest, DigestEntry } from "@/db/queries/digests";

export type DigestGroup = { topic: string; entries: DigestEntry[]; fresh: number };

const APPEND_GAP_MS = 60_000;

export const isRead = (e: DigestEntry) => e.opened_at !== null || e.reaction === -1;

export function groupDigest(digest: Digest, entries: DigestEntry[], topics: string[]): DigestGroup[] {
  const createdMs = new Date(digest.created_at).getTime();
  const byTopic = new Map<string, DigestEntry[]>();
  for (const e of entries) {
    if (e.tier !== "main") continue;
    const topic = e.topic ?? "";
    byTopic.set(topic, [...(byTopic.get(topic) ?? []), e]);
  }

  const rank = (topic: string) => {
    const i = topics.indexOf(topic);
    return i === -1 ? topics.length - 0.5 : i;
  };
  return [...byTopic.keys()]
    .sort((a, b) => rank(a) - rank(b))
    .map((topic) => {
      const list = byTopic.get(topic)!.sort((a, b) => a.position - b.position);
      const fresh = list.filter(
        (e) => new Date(e.added_at).getTime() - createdMs > APPEND_GAP_MS && !isRead(e),
      ).length;
      return { topic, entries: list, fresh };
    });
}
