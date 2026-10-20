# Data Model: Раздел «Сводка»

Все таблицы добавляются в `SCHEMA_SQL` (`desktop/src/db/schema.ts`) одной фазой, `CREATE TABLE IF NOT EXISTS` /
`CREATE INDEX IF NOT EXISTS`. Внутри SQL нет `;` и `--`, триггеров нет. Даты дня — `TEXT YYYY-MM-DD`,
моменты — `TEXT` ISO 8601 UTC (`2026-10-20T06:00:00.000Z`). Доступ — только `db/queries/digest*.ts`.

## digest_sources — источник

| Поле | Тип | Правила |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| kind | TEXT NOT NULL | `rss` / `reddit` / `github` / `hn` |
| value | TEXT NOT NULL | адрес ленты / имя сабреддита / `owner/repo` / `front_page` для HN |
| title | TEXT | подпись в UI, необязательна |
| encoding | TEXT | только `rss`; NULL = utf-8 |
| enabled | INTEGER NOT NULL DEFAULT 1 | |
| sort_order | INTEGER NOT NULL DEFAULT 0 | |
| last_ok_at | TEXT | момент последнего успешного опроса |
| last_error | TEXT | текст последней ошибки, NULL после успеха |
| last_error_at | TEXT | |
| last_count | INTEGER NOT NULL DEFAULT 0 | материалов в последнем опросе |
| created_at | TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP | |

`UNIQUE(kind, value)`. Reddit опрашивается одним запросом на все включённые сабреддиты, состояние
пишется во все строки `reddit`. HN — одна строка.

## digest_items — материал (кандидат)

| Поле | Тип | Правила |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| url | TEXT NOT NULL UNIQUE | дедуп: `INSERT OR IGNORE` |
| title | TEXT NOT NULL | пустой у импортированных из `seen.json` |
| source | TEXT NOT NULL | подпись («Хабр», «r/webdev», «GitHub», «HN») |
| source_id | INTEGER REFERENCES digest_sources(id) ON DELETE SET NULL | |
| domain | TEXT NOT NULL | хост без `www.`, ключ бана |
| published_at | TEXT | из источника; NULL — дата неизвестна |
| found_at | TEXT NOT NULL | момент первого обнаружения |
| blurb | TEXT | до 280 символов (GitHub — 400), только для промпта и поиска |
| image_url | TEXT | из ленты или `og:image` |
| preview_file | TEXT | имя файла в `digest-cache/`, NULL — нет или вычищен |
| preview_at | TEXT | момент сохранения превью |
| imported | INTEGER NOT NULL DEFAULT 0 | 1 = адрес из `seen.json`, в UI и поиске не показывается |

Индексы: `found_at`, `domain`. Кандидат «свежий» = `published_at` (или `found_at`, если даты нет) в окне свежести.

## digests — сводка дня

| Поле | Тип | Правила |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| date | TEXT NOT NULL UNIQUE | одна сводка в день |
| created_at | TEXT NOT NULL | |
| viewed_at | TEXT | NULL = новая; не NULL = просмотрена |
| model | TEXT NOT NULL | модель, отобравшая выпуск |
| candidates | INTEGER NOT NULL | сколько кандидатов ушло в запрос |

Переходы: `новая` → `просмотрена` (кнопка в шапке или все `main`-позиции имеют `opened_at` либо дизлайк).
Обратный переход `просмотрена` → `новая` — только при доборе: если «Собрать сейчас» дописал в сводку дня хотя бы
одну новую позицию, `viewed_at` = NULL. Сводка дня не удаляется и не пересоздаётся (`appendToDigest`).

## digest_entries — позиция в сводке

| Поле | Тип | Правила |
|---|---|---|
| digest_id | INTEGER NOT NULL REFERENCES digests(id) ON DELETE CASCADE | |
| item_id | INTEGER NOT NULL REFERENCES digest_items(id) ON DELETE CASCADE | |
| tier | TEXT NOT NULL | `main` / `near` |
| topic | TEXT | только `main`: метка темы из `digest_interests` (правило — `contracts/model-io.md`) или «Любопытное» |
| why | TEXT | только `main`, после `trimVerdict` |
| position | INTEGER NOT NULL | порядок внутри эшелона; добор продолжает после текущего максимума `main` |
| added_at | TEXT NOT NULL | момент вставки позиции; добор — группа «добавлено в ЧЧ:ММ» |
| opened_at | TEXT | момент перехода по ссылке |

`PRIMARY KEY (digest_id, item_id)`. За один прогон в `main` добавляется ≤ maxItems; сводка дня с доборами может
быть больше. `near` ≤ 8 и при доборе целиком заменяется результатом последнего прогона (удалить `near` сводки,
вставить новые). Позиция «добора» = `added_at` позже `digests.created_at` более чем на 1 минуту.

## digest_reactions — лайк/дизлайк

| Поле | Тип | Правила |
|---|---|---|
| item_id | INTEGER PK REFERENCES digest_items(id) ON DELETE CASCADE | одна реакция на материал |
| value | INTEGER NOT NULL | 1 = лайк, -1 = дизлайк; снятие = DELETE |
| created_at | TEXT NOT NULL | для «15 последних» и серий по источнику |

## digest_saved — «Сохранённое»

| Поле | Тип | Правила |
|---|---|---|
| item_id | INTEGER PK REFERENCES digest_items(id) ON DELETE CASCADE | |
| created_at | TEXT NOT NULL | |

## digest_bans — забаненные домены

| Поле | Тип | Правила |
|---|---|---|
| domain | TEXT PK | хост без `www.` |
| created_at | TEXT NOT NULL | |

## Настройки

`settings` (key/value, попадает в бэкап — секретов нет):

| Ключ | Дефолт |
|---|---|
| `digest_interests` | интересы Cairn строками |
| `digest_avoid` | «Не берёт» Cairn строками |
| `digest_max_items` | 12 |
| `digest_window_hours` | 26 |
| `digest_hn_min_points` | 150 |
| `digest_reddit_take` | 30 |
| `digest_time` | `09:00` |
| `digest_keep_digests_days` | 365 |
| `digest_keep_candidates_days` | 60 |
| `digest_keep_previews_days` | 90 |
| `digest_seeded` | `1` после импорта Cairn |
| `digest_last_attempt_at` / `digest_last_error` | состояние последней попытки |
| `digest_last_success_at` | момент последнего успешного прогона; кандидаты прогона = `found_at` позже него (повтор после сбоя видит те же материалы, добор — только новые) |
| `digest_attempts_date` / `digest_attempts_count` | неудачные плановые попытки за день (≤ 3, интервал 15 мин); счётчик сбрасывается со сменой даты |

localStorage (`createLocalStore`, не в бэкапе): `trail.imagegen.openRouterKey` (общий ключ OpenRouter,
имя ключа не меняется), `trail.digest.model` (`google/gemini-2.5-flash`), `trail.notifyDigest` (выключатель
тоста «Сводка готова», дефолт `"1"` — рядом с существующими `trail.notifyBirthdays` / `trail.notifyReminders`).

## Чистка (раз в сутки после сбора)

Порядок явный, не полагается на CASCADE (research R8):
1. сводки старше `keep_digests_days` → удалить их `digest_entries`, затем `digests`;
2. материалы с `found_at` старше `keep_candidates_days`, не входящие ни в одну позицию, не в `digest_saved`
   и без реакции → удалить;
3. превью с `preview_at` старше `keep_previews_days` → удалить файлы (`prune_digest_previews`),
   обнулить `preview_file`.
