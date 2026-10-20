import { getDb } from "../database";

export type Digest = {
  id: number;
  date: string;
  created_at: string;
  viewed_at: string | null;
  model: string;
  candidates: number;
  main_count: number;
};

export type DigestTier = "main" | "near";

export type DigestEntryInput = {
  itemId: number;
  tier: DigestTier;
  topic: string | null;
  why: string | null;
  position: number;
};

export type DigestEntry = {
  digest_id: number;
  item_id: number;
  tier: DigestTier;
  topic: string | null;
  why: string | null;
  position: number;
  added_at: string;
  opened_at: string | null;
  url: string;
  title: string;
  source: string;
  domain: string;
  published_at: string | null;
  image_url: string | null;
  preview_file: string | null;
  reaction: number | null;
  saved: number;
};

const DIGEST_COLUMNS = `d.id, d.date, d.created_at, d.viewed_at, d.model, d.candidates,
  (SELECT COUNT(*) FROM digest_entries e WHERE e.digest_id = d.id AND e.tier = 'main') AS main_count`;

export async function foreignKeysEnabled(): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select<{ foreign_keys: number }[]>("PRAGMA foreign_keys");
  return rows[0]?.foreign_keys === 1;
}

export async function getDigestByDate(date: string): Promise<Digest | null> {
  const db = await getDb();
  const rows = await db.select<Digest[]>(`SELECT ${DIGEST_COLUMNS} FROM digests d WHERE d.date = ?`, [date]);
  return rows[0] ?? null;
}

export async function listDigests(): Promise<Digest[]> {
  const db = await getDb();
  return db.select<Digest[]>(`SELECT ${DIGEST_COLUMNS} FROM digests d ORDER BY d.date DESC`);
}

export async function createDigest(input: {
  date: string;
  model: string;
  candidates: number;
  entries: DigestEntryInput[];
}): Promise<number> {
  const db = await getDb();
  const now = new Date().toISOString();
  const res = await db.execute(
    `INSERT INTO digests(date, created_at, model, candidates) VALUES(?, ?, ?, ?)`,
    [input.date, now, input.model, input.candidates],
  );
  const id = Number(res.lastInsertId);
  await insertEntries(id, input.entries, now);
  return id;
}

export async function appendToDigest(input: {
  digestId: number;
  candidates: number;
  main: DigestEntryInput[];
  near: DigestEntryInput[];
}): Promise<number> {
  const db = await getDb();
  const now = new Date().toISOString();
  const rows = await db.select<{ max: number | null }[]>(
    `SELECT MAX(position) AS max FROM digest_entries WHERE digest_id = ? AND tier = 'main'`,
    [input.digestId],
  );
  const offset = (rows[0]?.max ?? -1) + 1;
  await db.execute(`DELETE FROM digest_entries WHERE digest_id = ? AND tier = 'near'`, [input.digestId]);
  const added = await insertEntries(
    input.digestId,
    input.main.map((e) => ({ ...e, position: e.position + offset })),
    now,
  );
  await insertEntries(input.digestId, input.near, now);
  await db.execute(`UPDATE digests SET candidates = candidates + ? WHERE id = ?`, [
    input.candidates,
    input.digestId,
  ]);
  if (added > 0) {
    await db.execute(`UPDATE digests SET viewed_at = NULL WHERE id = ?`, [input.digestId]);
  }
  return added;
}

async function insertEntries(digestId: number, entries: DigestEntryInput[], addedAt: string): Promise<number> {
  if (entries.length === 0) return 0;
  const db = await getDb();
  const res = await db.execute(
    `INSERT OR IGNORE INTO digest_entries(digest_id, item_id, tier, topic, why, position, added_at)
     VALUES ${entries.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ")}`,
    entries.flatMap((e) => [digestId, e.itemId, e.tier, e.topic, e.why, e.position, addedAt]),
  );
  return res.rowsAffected;
}

export async function listEntries(digestId: number): Promise<DigestEntry[]> {
  const db = await getDb();
  return db.select<DigestEntry[]>(
    `SELECT e.digest_id, e.item_id, e.tier, e.topic, e.why, e.position, e.added_at, e.opened_at,
            i.url, i.title, i.source, i.domain, i.published_at, i.image_url, i.preview_file,
            r.value AS reaction,
            CASE WHEN s.item_id IS NULL THEN 0 ELSE 1 END AS saved
     FROM digest_entries e
     JOIN digest_items i ON i.id = e.item_id
     LEFT JOIN digest_reactions r ON r.item_id = e.item_id
     LEFT JOIN digest_saved s ON s.item_id = e.item_id
     WHERE e.digest_id = ?
     ORDER BY e.tier, e.position`,
    [digestId],
  );
}

export async function digestItemIds(digestId: number): Promise<number[]> {
  const db = await getDb();
  const rows = await db.select<{ item_id: number }[]>(
    `SELECT item_id FROM digest_entries WHERE digest_id = ?`,
    [digestId],
  );
  return rows.map((r) => r.item_id);
}

export async function markEntryOpened(digestId: number, itemId: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE digest_entries SET opened_at = COALESCE(opened_at, ?) WHERE digest_id = ? AND item_id = ?`,
    [new Date().toISOString(), digestId, itemId],
  );
}

export async function markDigestViewed(id: number): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE digests SET viewed_at = COALESCE(viewed_at, ?) WHERE id = ?`, [
    new Date().toISOString(),
    id,
  ]);
}
