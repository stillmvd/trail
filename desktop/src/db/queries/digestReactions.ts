import { getDb } from "../database";
import type { DigestItem } from "./digestItems";

export type DigestBan = { domain: string; created_at: string };

export async function setReaction(itemId: number, value: 1 | -1 | null): Promise<void> {
  const db = await getDb();
  if (value === null) {
    await db.execute(`DELETE FROM digest_reactions WHERE item_id = ?`, [itemId]);
    return;
  }
  await db.execute(
    `INSERT INTO digest_reactions(item_id, value, created_at) VALUES(?, ?, ?)
     ON CONFLICT(item_id) DO UPDATE SET value = excluded.value, created_at = excluded.created_at`,
    [itemId, value, new Date().toISOString()],
  );
}

export async function recentReactions(limit = 15): Promise<{ liked: string[]; disliked: string[] }> {
  const db = await getDb();
  const pick = (value: number) =>
    db.select<{ title: string }[]>(
      `SELECT i.title FROM digest_reactions r JOIN digest_items i ON i.id = r.item_id
       WHERE r.value = ? ORDER BY r.created_at DESC LIMIT ?`,
      [value, limit],
    );
  const [liked, disliked] = await Promise.all([pick(1), pick(-1)]);
  return { liked: liked.map((r) => r.title), disliked: disliked.map((r) => r.title) };
}

export async function dislikeStreaksBySource(minStreak = 3): Promise<{ source: string; streak: number }[]> {
  const db = await getDb();
  const rows = await db.select<{ source: string; value: number }[]>(
    `SELECT i.source, r.value FROM digest_reactions r JOIN digest_items i ON i.id = r.item_id
     ORDER BY r.created_at DESC`,
  );
  const streaks = new Map<string, number>();
  const closed = new Set<string>();
  for (const { source, value } of rows) {
    if (closed.has(source)) continue;
    if (value === -1) streaks.set(source, (streaks.get(source) ?? 0) + 1);
    else closed.add(source);
  }
  return [...streaks]
    .filter(([, streak]) => streak >= minStreak)
    .map(([source, streak]) => ({ source, streak }));
}

export async function toggleSaved(itemId: number): Promise<boolean> {
  const db = await getDb();
  const res = await db.execute(`DELETE FROM digest_saved WHERE item_id = ?`, [itemId]);
  if (res.rowsAffected > 0) return false;
  await db.execute(`INSERT INTO digest_saved(item_id, created_at) VALUES(?, ?)`, [
    itemId,
    new Date().toISOString(),
  ]);
  return true;
}

export async function listSaved(): Promise<(DigestItem & { saved_at: string })[]> {
  const db = await getDb();
  return db.select<(DigestItem & { saved_at: string })[]>(
    `SELECT i.id, i.url, i.title, i.source, i.domain, i.published_at, i.found_at,
            i.blurb, i.image_url, i.preview_file, s.created_at AS saved_at
     FROM digest_saved s JOIN digest_items i ON i.id = s.item_id
     ORDER BY s.created_at DESC`,
  );
}

export async function banDomain(domain: string): Promise<void> {
  const db = await getDb();
  await db.execute(`INSERT OR IGNORE INTO digest_bans(domain, created_at) VALUES(?, ?)`, [
    domain,
    new Date().toISOString(),
  ]);
}

export async function unbanDomain(domain: string): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM digest_bans WHERE domain = ?`, [domain]);
}

export async function listBans(): Promise<DigestBan[]> {
  const db = await getDb();
  return db.select<DigestBan[]>(`SELECT domain, created_at FROM digest_bans ORDER BY created_at DESC`);
}
