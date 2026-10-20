import { getDb } from "../database";

export type CandidateInput = {
  url: string;
  title: string;
  source: string;
  sourceId: number | null;
  domain: string;
  publishedAt: string | null;
  blurb: string | null;
  imageUrl: string | null;
};

export type DigestItem = {
  id: number;
  url: string;
  title: string;
  source: string;
  domain: string;
  published_at: string | null;
  found_at: string;
  blurb: string | null;
  image_url: string | null;
  preview_file: string | null;
};

const ITEM_COLUMNS = `i.id, i.url, i.title, i.source, i.domain, i.published_at, i.found_at,
  i.blurb, i.image_url, i.preview_file`;

const CHUNK = 400;

export async function insertCandidates(items: CandidateInput[], foundAt: string): Promise<number> {
  const db = await getDb();
  let inserted = 0;
  for (let start = 0; start < items.length; start += CHUNK) {
    const chunk = items.slice(start, start + CHUNK);
    const res = await db.execute(
      `INSERT OR IGNORE INTO digest_items
         (url, title, source, source_id, domain, published_at, found_at, blurb, image_url)
       VALUES ${chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}`,
      chunk.flatMap((c) => [
        c.url,
        c.title,
        c.source,
        c.sourceId,
        c.domain,
        c.publishedAt,
        foundAt,
        c.blurb,
        c.imageUrl,
      ]),
    );
    inserted += res.rowsAffected;
  }
  return inserted;
}

export async function importSeenUrls(urls: string[], foundAt: string): Promise<number> {
  const db = await getDb();
  let inserted = 0;
  for (let start = 0; start < urls.length; start += CHUNK) {
    const chunk = urls.slice(start, start + CHUNK);
    const res = await db.execute(
      `INSERT OR IGNORE INTO digest_items (url, title, source, domain, found_at, imported)
       VALUES ${chunk.map(() => "(?, '', 'Cairn', ?, ?, 1)").join(", ")}`,
      chunk.flatMap((url) => [url, domainOf(url), foundAt]),
    );
    inserted += res.rowsAffected;
  }
  return inserted;
}

export async function freshCandidates(input: {
  foundAfter: string | null;
  windowStart: string;
}): Promise<DigestItem[]> {
  const db = await getDb();
  return db.select<DigestItem[]>(
    `SELECT ${ITEM_COLUMNS} FROM digest_items i
     WHERE i.imported = 0
       AND (? IS NULL OR i.found_at > ?)
       AND COALESCE(i.published_at, i.found_at) >= ?
       AND i.domain NOT IN (SELECT domain FROM digest_bans)
     ORDER BY i.id`,
    [input.foundAfter, input.foundAfter, input.windowStart],
  );
}

export async function getItem(id: number): Promise<DigestItem | null> {
  const db = await getDb();
  const rows = await db.select<DigestItem[]>(`SELECT ${ITEM_COLUMNS} FROM digest_items i WHERE i.id = ?`, [id]);
  return rows[0] ?? null;
}

export async function setPreview(id: number, file: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE digest_items SET preview_file = ?, preview_at = ? WHERE id = ?`, [
    file,
    new Date().toISOString(),
    id,
  ]);
}

export async function searchItems(query: string, limit = 100): Promise<DigestItem[]> {
  const db = await getDb();
  const like = `%${query.trim()}%`;
  return db.select<DigestItem[]>(
    `SELECT ${ITEM_COLUMNS} FROM digest_items i
     WHERE i.imported = 0 AND (i.title LIKE ? OR i.source LIKE ?)
     ORDER BY i.found_at DESC LIMIT ?`,
    [like, like, limit],
  );
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
