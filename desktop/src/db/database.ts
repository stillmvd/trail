import Database from "@tauri-apps/plugin-sql";
import { SCHEMA_SQL } from "./schema";

let dbPromise: Promise<Database> | null = null;

async function init(): Promise<Database> {
  const db = await Database.load("sqlite:timeline.db");
  const bare = SCHEMA_SQL.split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
  for (const stmt of bare.split(";")) {
    const sql = stmt.trim();
    if (sql) await db.execute(sql);
  }
  await migrate(db);
  return db;
}

async function migrate(db: Database): Promise<void> {
  if (!(await hasColumn(db, "events", "end_date"))) {
    await db.execute("ALTER TABLE events ADD COLUMN end_date TEXT");
  }
  if (!(await hasColumn(db, "events", "track"))) {
    await db.execute("ALTER TABLE events ADD COLUMN track INTEGER NOT NULL DEFAULT 0");
  }
  if (await hasColumn(db, "reminders", "pre_notify_days")) {
    await db.execute("DROP TABLE reminders");
    await db.execute(`CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      note TEXT,
      date TEXT NOT NULL,
      time TEXT,
      repeat TEXT NOT NULL DEFAULT 'none',
      repeat_every INTEGER,
      repeat_unit TEXT,
      pre_notify_min INTEGER NOT NULL DEFAULT 0,
      nag INTEGER NOT NULL DEFAULT 0,
      nag_interval_min INTEGER,
      icon TEXT,
      color TEXT,
      event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
      snoozed_until TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.execute("CREATE INDEX IF NOT EXISTS idx_reminders_date ON reminders(date)");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_reminders_event ON reminders(event_id)");
  }
  if (await hasColumn(db, "marks", "category_id")) {
    await db.execute("DROP TABLE marks");
    await db.execute(`CREATE TABLE IF NOT EXISTS marks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      mark_type_id INTEGER NOT NULL REFERENCES mark_types(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.execute("CREATE INDEX IF NOT EXISTS idx_marks_date ON marks(date)");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_marks_type ON marks(mark_type_id)");
  }
  for (const table of DIGEST_TABLES) await db.execute(`DROP TABLE IF EXISTS ${table}`);
  await db.execute("DELETE FROM settings WHERE key LIKE 'digest\\_%' ESCAPE '\\'");
}

const DIGEST_TABLES = [
  "digest_entries",
  "digest_reactions",
  "digest_saved",
  "digest_items",
  "digests",
  "digest_sources",
  "digest_bans",
];

async function hasColumn(db: Database, table: string, column: string): Promise<boolean> {
  const rows = await db.select<{ name: string }[]>(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

export function getDb(): Promise<Database> {
  dbPromise ??= init();
  return dbPromise;
}
