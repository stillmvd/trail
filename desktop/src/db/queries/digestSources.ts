import { getDb } from "../database";

export type DigestSourceKind = "rss" | "reddit" | "github" | "hn";

export type DigestSource = {
  id: number;
  kind: DigestSourceKind;
  value: string;
  title: string | null;
  encoding: string | null;
  enabled: number;
  sort_order: number;
  last_ok_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
  last_count: number;
};

export type DigestSourceInput = {
  kind: DigestSourceKind;
  value: string;
  title?: string | null;
  encoding?: string | null;
};

export async function listSources(): Promise<DigestSource[]> {
  const db = await getDb();
  return db.select<DigestSource[]>(
    `SELECT id, kind, value, title, encoding, enabled, sort_order,
            last_ok_at, last_error, last_error_at, last_count
     FROM digest_sources ORDER BY kind, sort_order, id`,
  );
}

export async function createSource(input: DigestSourceInput): Promise<number> {
  const db = await getDb();
  const res = await db.execute(
    `INSERT OR IGNORE INTO digest_sources(kind, value, title, encoding, sort_order)
     VALUES(?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM digest_sources WHERE kind = ?))`,
    [input.kind, input.value, input.title ?? null, input.encoding ?? null, input.kind],
  );
  return Number(res.lastInsertId);
}

export async function updateSource(
  id: number,
  patch: { value: string; title: string | null; encoding: string | null; enabled: boolean },
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE digest_sources SET value = ?, title = ?, encoding = ?, enabled = ? WHERE id = ?`,
    [patch.value, patch.title, patch.encoding, patch.enabled ? 1 : 0, id],
  );
}

export async function deleteSource(id: number): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE digest_items SET source_id = NULL WHERE source_id = ?`, [id]);
  await db.execute(`DELETE FROM digest_sources WHERE id = ?`, [id]);
}

export async function markSourceOk(id: number, count: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE digest_sources SET last_ok_at = ?, last_error = NULL, last_count = ? WHERE id = ?`,
    [new Date().toISOString(), count, id],
  );
}

export async function markSourceError(id: number, message: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE digest_sources SET last_error = ?, last_error_at = ?, last_count = 0 WHERE id = ?`,
    [message, new Date().toISOString(), id],
  );
}

export async function markKindOk(kind: DigestSourceKind, count: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE digest_sources SET last_ok_at = ?, last_error = NULL, last_count = ?
     WHERE kind = ? AND enabled = 1`,
    [new Date().toISOString(), count, kind],
  );
}

export async function markKindError(kind: DigestSourceKind, message: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE digest_sources SET last_error = ?, last_error_at = ?, last_count = 0
     WHERE kind = ? AND enabled = 1`,
    [message, new Date().toISOString(), kind],
  );
}
