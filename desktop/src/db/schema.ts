export const SCHEMA_SQL = `
-- Timeline schema. Даты событий хранятся как TEXT 'YYYY-MM-DD'.
-- Идемпотентно: безопасно повторное выполнение.

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL,                              -- YYYY-MM-DD (начало)
  end_date TEXT,                                   -- YYYY-MM-DD, NULL = точечное событие
  significance INTEGER NOT NULL DEFAULT 1 CHECK(significance IN (1, 2, 3)),
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  track INTEGER NOT NULL DEFAULT 0,                -- 1 = показывать в разделе «Отслеживание»
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category_id);
CREATE INDEX IF NOT EXISTS idx_events_significance ON events(significance);

-- Типы отметок: отдельный справочник трекеров (имя/иконка/цвет), независим от категорий событий.
CREATE TABLE IF NOT EXISTS mark_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Отметки: быстрый лог дня без названия — дата + тип отметки (иконка на оси/в календаре).
CREATE TABLE IF NOT EXISTS marks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,                              -- YYYY-MM-DD
  mark_type_id INTEGER NOT NULL REFERENCES mark_types(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_marks_date ON marks(date);
CREATE INDEX IF NOT EXISTS idx_marks_type ON marks(mark_type_id);

CREATE TABLE IF NOT EXISTS event_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  path TEXT NOT NULL,                              -- относительный путь в data/media/
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_event_media_event ON event_media(event_id);
CREATE INDEX IF NOT EXISTS idx_event_media_cover ON event_media(event_id, sort_order, id);

-- Люди: отдельная сущность для раздела «Дни рождения» (не событие и не отметка).
-- birth_date всегда YYYY-MM-DD; при has_year=0 год фиктивный (2000) и возраст скрыт.
CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  birth_date TEXT NOT NULL,
  has_year INTEGER NOT NULL DEFAULT 1,
  photo TEXT,                                     -- относительный путь в data/media/, NULL = нет фото
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_people_birth ON people(birth_date);

-- Напоминания: самостоятельная сущность с временем, повторами и настройками уведомлений.
-- date — ближайшее срабатывание; у повторяющихся после «выполнено» переезжает на следующее вхождение.
CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  note TEXT,
  date TEXT NOT NULL,                              -- YYYY-MM-DD
  time TEXT,                                       -- HH:MM, NULL = «в течение дня»
  repeat TEXT NOT NULL DEFAULT 'none',             -- none|daily|weekly|monthly|yearly|custom
  repeat_every INTEGER,                            -- шаг custom-повтора («каждые N»)
  repeat_unit TEXT,                                -- day|week для custom
  pre_notify_min INTEGER NOT NULL DEFAULT 0,       -- за сколько минут предупредить, 0 = выкл
  nag INTEGER NOT NULL DEFAULT 0,                  -- 1 = повторять уведомление до выполнения
  nag_interval_min INTEGER,
  icon TEXT,
  color TEXT,
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  snoozed_until TEXT,                              -- YYYY-MM-DDTHH:MM
  completed_at TEXT,                               -- NULL = активно (для повторяющихся всегда NULL)
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reminders_date ON reminders(date);
CREATE INDEX IF NOT EXISTS idx_reminders_event ON reminders(event_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS digest_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  title TEXT,
  encoding TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  last_ok_at TEXT,
  last_error TEXT,
  last_error_at TEXT,
  last_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(kind, value)
);

CREATE TABLE IF NOT EXISTS digest_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  source_id INTEGER REFERENCES digest_sources(id) ON DELETE SET NULL,
  domain TEXT NOT NULL,
  published_at TEXT,
  found_at TEXT NOT NULL,
  blurb TEXT,
  image_url TEXT,
  preview_file TEXT,
  preview_at TEXT,
  imported INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_digest_items_found ON digest_items(found_at);
CREATE INDEX IF NOT EXISTS idx_digest_items_domain ON digest_items(domain);

CREATE TABLE IF NOT EXISTS digests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  viewed_at TEXT,
  model TEXT NOT NULL,
  candidates INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS digest_entries (
  digest_id INTEGER NOT NULL REFERENCES digests(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES digest_items(id) ON DELETE CASCADE,
  tier TEXT NOT NULL,
  topic TEXT,
  why TEXT,
  position INTEGER NOT NULL,
  added_at TEXT NOT NULL,
  opened_at TEXT,
  PRIMARY KEY (digest_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_digest_entries_item ON digest_entries(item_id);

CREATE TABLE IF NOT EXISTS digest_reactions (
  item_id INTEGER PRIMARY KEY REFERENCES digest_items(id) ON DELETE CASCADE,
  value INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS digest_saved (
  item_id INTEGER PRIMARY KEY REFERENCES digest_items(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS digest_bans (
  domain TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
`;
