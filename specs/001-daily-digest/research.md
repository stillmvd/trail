# Research: Раздел «Сводка»

Источник фактов — разведка кода Trail (ветка main, 0.4.0) и `C:\Users\stillmvd\Projects\Cairn\digest.mjs`.

## R1. Где выполнять сбор: фронт (TS) или Rust

- **Decision**: фронт, TypeScript, модуль `desktop/src/lib/digest/`.
- **Rationale**: вся работа с БД в Trail идёт из TS через tauri-plugin-sql (`db/queries/*`), Rust базу не трогает;
  `@tauri-apps/plugin-http` уже стоит и обходит CORS (пример — `lib/imageGen.ts`); фича `unsafe-headers`
  уже включена — можно ставить `user-agent` (Reddit отвечает только «браузерному» UA, как в Cairn `BROWSER_UA`).
  Новых зависимостей не нужно.
- **Alternatives**: Rust (reqwest + quick-xml + encoding_rs + фоновый таск) — reqwest есть только транзитивно,
  понадобился бы второй доступ к SQLite или передача данных во фронт; сложнее без выгоды.

## R2. Разбор RSS/Atom и кодировки

- **Decision**: встроенный `DOMParser` (`application/xml`) для RSS 2.0 (`item`, `link`, `pubDate`, `description`,
  `enclosure`, `media:content`/`media:thumbnail`) и Atom (`entry`, `link[href]`, `updated`/`published`, `summary`).
  Тело читается `arrayBuffer()` и декодируется `new TextDecoder(encoding ?? "utf-8")` — для Пикабу `windows-1251`.
- **Rationale**: rss-parser в Cairn тянет xml2js под Node; в WebView2 есть нативный парсер и TextDecoder
  с legacy-кодировками.
- **Alternatives**: `rss-parser` браузерной сборкой — лишний бандл и та же логика.

## R3. Эндпоинты источников (перенос из Cairn как есть)

| Источник | Запрос | Заметки |
|---|---|---|
| HN | `https://hn.algolia.com/api/v1/search?tags=front_page&numericFilters=points>{min}` | JSON, url — `hit.url` или `news.ycombinator.com/item?id=` |
| Reddit | `https://www.reddit.com/r/{a+b+c}/top.rss?t=day`, берётся первые `take` | один запрос на все сабреддиты, UA браузера |
| GitHub | `https://api.github.com/repos/{repo}/releases/latest` | JSON, без токена (60 запросов/ч хватает) |
| RSS | адрес ленты, необязательная кодировка | UA `digest-bot/1.0 (personal use)` |

Подписи источников: `SOURCE_NAMES` Cairn (`habr.com` → «Хабр», `pikabu.ru` → «Пикабу»), иначе заголовок ленты или хост.

## R4. Права на сеть в `capabilities/default.json`

- **Decision**: `http:default.allow` += `{ "url": "https://*/*" }` (плюс существующие localhost-записи).
- **Rationale**: ленты добавляются из UI на произвольные домены, а превью `og:image` берётся со страницы
  материала — домен заранее неизвестен; белый список с добавлением из UI потребовал бы пересборки capabilities
  (scope статичен). Риск ограничен: приложение одного пользователя, тексты из лент выводятся только как
  текст React (без `dangerouslySetInnerHTML`), CSP уже `null`.
- **Alternatives**: белый список (`hn.algolia.com`, `www.reddit.com`, `api.github.com` + ленты) — ломает
  превью и добавление лент без релиза; `http://*/*` — не нужен.

## R5. Кеш превью

- **Decision**: отдельная папка `%APPDATA%\com.stillmvd.trail\digest-cache\` (рядом с `media/`, но не в ней);
  две Rust-команды по образцу `save_media`/`delete_media`: `save_digest_preview(name, data)` и
  `prune_digest_previews(names_to_keep | older_than_days)`; `assetProtocol.scope` += `$APPDATA/digest-cache/**`;
  в `lib/paths.ts` — `previewSrc(name)` по образцу `mediaSrc`.
- **Rationale**: `create_backup` зипует `media/` целиком (`lib.rs:~75`) — превью на 90 дней раздули бы бэкапы;
  кеш восстанавливается сам. Байты качаются во фронте через plugin-http (`arrayBuffer`) и передаются
  командой, как фото событий.
- **Источник картинки**: `enclosure`/`media:content`/`media:thumbnail` из ленты; иначе для отобранных
  (≤ 12) — `<meta property="og:image">` со страницы (DOMParser `text/html`), таймаут 8 с, без повторов.
  Второй эшелон превью не получает.

## R6. Фон и расписание

- **Decision**: хук `useDigestScheduler` в `App()` по образцу `useAutoBackup` (`lib/backup.ts:67`) и
  `useNotifications` (`lib/notifications.ts:183`): `setInterval` 5 мин + запуск при старте; «пора» =
  сводки за сегодня нет ∧ текущее время ≥ времени сбора ∧ сбор не идёт (модульный флаг) ∧
  неудачных попыток за сегодня < 3 ∧ с последней неудачной прошло ≥ 15 мин. Счётчик —
  `digest_attempts_date` + `digest_attempts_count` в `settings` (переживает перезапуск), ошибка —
  `digest_last_error`. Нет ключа — попытка не засчитывается. Интервал 5 мин даёт повтор через 15–20 мин.
- **Rationale**: webview живёт и в трее (окно только прячется, автостарт `--minimized` грузит JS);
  интервал переживает сон ПК (комментарий в `notifications.ts`).

## R7. Отбор: один запрос к модели

- **Decision**: порт `rank()` Cairn (`digest.mjs:162`) с сохранением промпта дословно (интересы, «Не берёт»,
  зарезервированные 1–2 места, три запрета для `why`, примеры) и расширением: блок «Брал / Отклонял»
  (15 последних реакций заголовками), блок статистики источников, поле `topic` из меток интересов
  (`topicsFromInterests`, правило — `contracts/model-io.md`) плюс «Любопытное», массив `near` (до 8: `i`, `t`).
  «Собрать сейчас» при существующей сводке — добор (`appendToDigest`), не замена. Сверка — порт `resolvePicks`,
  `normalize`, `trimVerdict`, `extractJson` (`digest.mjs:153–260`). Интересы из массива Cairn
  переходят в свободный текст (строки через перевод строки), в промпт подставляются как есть.
- **Транспорт**: общий `lib/openrouter.ts` — вынести `postJson` (`imageGen.ts:249`) и `openRouterKeyStore`
  (`imageGen.ts:12`, ключ localStorage `trail.imagegen.openRouterKey` — оставить тот же ключ, чтобы не
  потерять введённый). Модель — `createLocalStore("trail.digest.model", "google/gemini-2.5-flash")`.
- **Контракт** — `contracts/model-io.md`.

## R8. PRAGMA foreign_keys

- **Decision**: при инициализации раздела один раз читать `PRAGMA foreign_keys`; если 0 — не полагаться
  на `ON DELETE CASCADE`: чистка удаляет зависимые строки явно в `db/queries/digest*.ts` (порядок:
  entries → reactions/saved не трогать → items). В схеме CASCADE оставить.
- **Rationale**: явного `PRAGMA` в `database.ts` нет; tauri-plugin-sql работает пулом sqlx, где включение
  на соединение не гарантировано из TS. Явная чистка корректна в обоих случаях.

## R9. Поиск и горячие клавиши

- **Decision**: `SearchHost` (`components/search/SearchHost.tsx:26–29`) не открывается в режиме `digest`;
  `/` и Ctrl+F там фокусируют поле поиска раздела. Клавиши по `KeyboardEvent.code` (работают в русской
  раскладке): `KeyJ`/`KeyK` — следующая/предыдущая, `Enter` — открыть, `KeyL` — лайк, `KeyD` — дизлайк,
  `KeyS` — звезда; игнорируются при фокусе в поле ввода.
- **Поиск раздела**: SQL `LIKE` по `title`/`source` хранимых материалов (объёмы малы: ~300 кандидатов в день × 60 дней).

## R10. Открытие ссылки

- **Decision**: `openUrl` из `@tauri-apps/plugin-opener` (уже стоит, `opener:default` разрешает http/https).

## R11. Сигнал готовности и навигация

- Тост — существующая команда `notify` (`lib.rs:202`) через `winToast` (`lib/notifications.ts`) с `kind: "digest"`,
  `id: digest.id`, без кнопок; ветка `kind === "digest"` в обработчике `notification-action`
  (`components/events/RemindersProvider.tsx:80`) → `modeStore.set("digest")`.
- Трей — пункт «Сводка» в `setup_tray` (`lib.rs:~255`) по образцу `add_reminder`: `show_main` + `emit("open-digest")`.
- Точка на пункте rail — стор «сегодняшняя не просмотрена» (`useSyncExternalStore`), обновляется после сбора
  и после отметки просмотра.

## R12. Импорт из Cairn

- **Decision**: разовая миграция данных при первой инициализации раздела (флаг `digest_seeded` в `settings`):
  встроенный в бандл снимок `sources.json` (передаёт cairn-15) → таблица источников и настройки;
  `seen.json` (3000 URL) → `digest_items` с `imported = 1`, пустым заголовком и `found_at` = момент импорта,
  `INSERT OR IGNORE`.
- **Rationale**: Cairn удаляется после переезда — читать его папку в рантайме нельзя.
