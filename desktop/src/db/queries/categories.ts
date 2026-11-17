import type Database from "@tauri-apps/plugin-sql";
import { getDb } from "../database";
import { shadeColor } from "@/lib/colors";

export type Category = {
  id: number;
  name: string;
  icon: string;
  color: string;
  parent_id: number | null;
  sort_order: number;
  is_default: number;
};

export type CategoryNode = Category & { children: Category[] };

export type CategoryInput = {
  name: string;
  icon: string;
  color: string;
  parentId: number | null;
  sortOrder?: number;
};

export async function listCategoriesFlat(): Promise<Category[]> {
  const db = await getDb();
  return db.select<Category[]>(
    `SELECT id, name, icon, color, parent_id, sort_order, is_default
     FROM categories
     ORDER BY sort_order, id`,
  );
}

export async function listCategories(): Promise<CategoryNode[]> {
  const flat = await listCategoriesFlat();
  const roots: CategoryNode[] = [];
  const byId = new Map<number, CategoryNode>();

  for (const cat of flat) {
    if (cat.parent_id === null) {
      const node: CategoryNode = { ...cat, children: [] };
      byId.set(cat.id, node);
      roots.push(node);
    }
  }
  for (const cat of flat) {
    if (cat.parent_id !== null) {
      byId.get(cat.parent_id)?.children.push(cat);
    }
  }
  return roots;
}

export async function createCategory(input: CategoryInput): Promise<number> {
  const db = await getDb();
  const res = await db.execute(
    `INSERT INTO categories(name, icon, color, parent_id, sort_order)
     VALUES(?, ?, ?, ?, ?)`,
    [input.name, input.icon, input.color, input.parentId, input.sortOrder ?? 0],
  );
  return Number(res.lastInsertId);
}

export async function updateCategory(id: number, input: CategoryInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE categories
     SET name = ?, icon = ?, color = ?, parent_id = ?, sort_order = ?
     WHERE id = ?`,
    [input.name, input.icon, input.color, input.parentId, input.sortOrder ?? 0, id],
  );
}

export async function countEventsByCategory(): Promise<Record<number, number>> {
  const db = await getDb();
  const rows = await db.select<{ id: number; n: number }[]>(
    `SELECT category_id AS id, COUNT(*) AS n
     FROM events
     WHERE category_id IS NOT NULL
     GROUP BY category_id`,
  );
  return Object.fromEntries(rows.map((r) => [r.id, r.n]));
}

export async function reorderCategories(ids: number[], from = 0): Promise<void> {
  const db = await getDb();
  for (const [i, id] of ids.entries()) {
    await db.execute("UPDATE categories SET sort_order = ? WHERE id = ?", [from + i, id]);
  }
}

export async function shadeGroups(db: Database, parentIds?: number[]): Promise<void> {
  const parents = await db.select<{ id: number; color: string }[]>(
    "SELECT id, color FROM categories WHERE parent_id IS NULL",
  );
  for (const parent of parents) {
    if (parentIds && !parentIds.includes(parent.id)) continue;
    const children = await db.select<{ id: number }[]>(
      "SELECT id FROM categories WHERE parent_id = ? ORDER BY sort_order, id",
      [parent.id],
    );
    for (const [i, child] of children.entries()) {
      await db.execute("UPDATE categories SET color = ? WHERE id = ?", [
        shadeColor(parent.color, i, children.length),
        child.id,
      ]);
    }
  }
}

export async function shadeGroup(parentId: number | null): Promise<void> {
  if (parentId === null) return;
  await shadeGroups(await getDb(), [parentId]);
}

async function nextSortOrder(db: Database, parentId: number | null): Promise<number> {
  const rows = await db.select<{ m: number | null }[]>(
    "SELECT MAX(sort_order) AS m FROM categories WHERE parent_id IS ?",
    [parentId],
  );
  return (rows[0]?.m ?? 0) + 1;
}

export async function moveCategory(id: number, parentId: number | null): Promise<void> {
  const db = await getDb();
  const [cat] = await db.select<Category[]>("SELECT * FROM categories WHERE id = ?", [id]);
  if (!cat || cat.parent_id === parentId) return;
  await db.execute("UPDATE categories SET parent_id = ?, sort_order = ? WHERE id = ?", [
    parentId,
    await nextSortOrder(db, parentId),
    id,
  ]);
  await shadeGroups(
    db,
    [cat.parent_id, parentId].filter((p): p is number => p !== null),
  );
}

export async function deleteCategory(id: number, targetId: number | null = null): Promise<void> {
  const db = await getDb();
  const [cat] = await db.select<Category[]>("SELECT * FROM categories WHERE id = ?", [id]);
  if (!cat) return;
  await db.execute("UPDATE events SET category_id = ? WHERE category_id = ?", [targetId, id]);
  const children = await db.select<{ id: number }[]>(
    "SELECT id FROM categories WHERE parent_id = ? ORDER BY sort_order, id",
    [id],
  );
  let order = await nextSortOrder(db, targetId);
  for (const child of children) {
    await db.execute("UPDATE categories SET parent_id = ?, sort_order = ? WHERE id = ?", [targetId, order++, child.id]);
  }
  await db.execute("DELETE FROM categories WHERE id = ?", [id]);
  await shadeGroups(
    db,
    [cat.parent_id, targetId].filter((p): p is number => p !== null),
  );
}
