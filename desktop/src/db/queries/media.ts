import { getDb } from "../database";

export type EventMedia = {
  id: number;
  event_id: number;
  path: string;
  sort_order: number;
  created_at: string;
};

export async function listMediaByEvent(eventId: number): Promise<EventMedia[]> {
  const db = await getDb();
  return db.select<EventMedia[]>(
    `SELECT id, event_id, path, sort_order, created_at
     FROM event_media
     WHERE event_id = ?
     ORDER BY sort_order, id`,
    [eventId],
  );
}

export async function addMedia(eventId: number, relPath: string): Promise<number> {
  const db = await getDb();
  const res = await db.execute(
    `INSERT INTO event_media(event_id, path, sort_order)
     VALUES(?, ?, (SELECT COALESCE(MAX(sort_order) + 1, 0) FROM event_media WHERE event_id = ?))`,
    [eventId, relPath, eventId],
  );
  return Number(res.lastInsertId);
}

export type MediaRef = { kind: "event" | "person"; id: number; path: string };

export async function listAllMediaRefs(): Promise<MediaRef[]> {
  const db = await getDb();
  const events = await db.select<{ id: number; path: string }[]>("SELECT id, path FROM event_media");
  const people = await db.select<{ id: number; path: string }[]>(
    "SELECT id, photo AS path FROM people WHERE photo IS NOT NULL AND photo <> ''",
  );
  return [
    ...events.map((r) => ({ kind: "event" as const, ...r })),
    ...people.map((r) => ({ kind: "person" as const, ...r })),
  ];
}

export async function replaceMediaPath(ref: MediaRef, next: string): Promise<boolean> {
  const db = await getDb();
  const res =
    ref.kind === "event"
      ? await db.execute("UPDATE event_media SET path = ? WHERE id = ? AND path = ?", [next, ref.id, ref.path])
      : await db.execute("UPDATE people SET photo = ? WHERE id = ? AND photo = ?", [next, ref.id, ref.path]);
  return res.rowsAffected > 0;
}

export async function snapshotDatabase(dest: string): Promise<void> {
  const db = await getDb();
  await db.execute(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
}

export async function deleteMedia(id: number): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ path: string }[]>(
    "SELECT path FROM event_media WHERE id = ?",
    [id],
  );
  await db.execute("DELETE FROM event_media WHERE id = ?", [id]);
  return rows[0]?.path ?? null;
}
