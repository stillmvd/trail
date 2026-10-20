# Tasks: Раздел «Сводка» — ежедневный новостной дайджест

**Input**: Design documents from `specs/001-daily-digest/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: отдельных тестовых задач нет (не запрошены, тест-раннера в проекте нет). Единственная запускаемая
проверка — `desktop/scripts/digest-selftest.ts` (T014), плюс `npx tsc --noEmit` после каждой фазы и ручные сценарии
`quickstart.md`.

**Organization**: по user stories spec.md. Фаза «Стенды» стоит между сбором и интерфейсом: стенды строятся на
настоящих кандидатах из БД, а интерфейс без выбора по стенду не реализуется (конституция, принцип III).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно параллельно (другие файлы, нет зависимостей от незавершённых задач)
- **[Story]**: US1–US6 из spec.md

## Path Conventions

Все пути — от корня репозитория Trail; код в `desktop/`. Коммит — в конце каждой фазы, conventional по-русски
(`feat: …`), только файлы фазы.

---

## Phase 1: Setup

- [X] T001 Закоммитить каркас spec-kit и документы фичи отдельным коммитом `chore: каркас spec-kit и спека раздела «Сводка»` (`.specify/`, `specs/001-daily-digest/`) на ветке `001-daily-digest`
- [X] T002 Вынести `postJson` (`desktop/src/lib/imageGen.ts:249`) и `openRouterKeyStore` (`imageGen.ts:12`, ключ localStorage `trail.imagegen.openRouterKey` не менять) в новый `desktop/src/lib/openrouter.ts`; `imageGen.ts` импортирует оттуда; поведение картинок не меняется
- [X] T003 [P] Разрешить сеть и кеш: `desktop/src-tauri/capabilities/default.json` → `http:default.allow` += `{ "url": "https://*/*" }`; `desktop/src-tauri/tauri.conf.json` → `app.security.assetProtocol.scope` += `"$APPDATA/digest-cache/**"` (правка текстовая, без перепечатки JSON)
- [X] T004 [P] Получить от cairn-15 точное содержимое `sources.json` и `seen.json` Cairn и положить в `desktop/src/lib/digest/cairn-seed.json` как `{ sources: <sources.json>, seen: <массив URL> }`

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: до конца фазы ни одна user story не начинается.

- [X] T005 Добавить в `SCHEMA_SQL` (`desktop/src/db/schema.ts`) таблицы `digest_sources`, `digest_items`, `digests`, `digest_entries`, `digest_reactions`, `digest_saved`, `digest_bans` и индексы `digest_items(found_at)`, `digest_items(domain)` строго по `data-model.md`: `digest_items.url TEXT NOT NULL UNIQUE`, `digests.date TEXT NOT NULL UNIQUE`, `digest_sources UNIQUE(kind, value)`, `digest_entries PRIMARY KEY (digest_id, item_id)` и `added_at TEXT NOT NULL`, `digest_reactions.value` «1 = лайк, -1 = дизлайк»; только `CREATE … IF NOT EXISTS`, внутри SQL нет `;` и `--`, без триггеров
- [X] T006 При первой инициализации раздела прочитать `PRAGMA foreign_keys` и вывести результат в dev-консоль (`console.info` только при `import.meta.env.DEV`); чистка в любом случае удаляет зависимые строки явно (research R8) — в `desktop/src/db/queries/digests.ts`
- [X] T007 [P] `desktop/src/db/queries/digestSources.ts`: `listSources`, `createSource`, `updateSource`, `deleteSource`, `markSourceOk(id, count)`, `markSourceError(id, message)`, `markKindOk/markKindError` для reddit (все строки `kind = 'reddit'`)
- [X] T008 [P] `desktop/src/db/queries/digestItems.ts`: `insertCandidates(items)` через `INSERT OR IGNORE` по `url` с возвратом id новых строк, `freshCandidates(sinceISO)` (кроме `imported = 1` и забаненных доменов), `setPreview(id, file)`, `clearPreviews(olderThanISO)` → список имён файлов, `searchItems(query)` по `title`/`source` (`LIKE`, без `imported = 1`)
- [X] T009 [P] `desktop/src/db/queries/digests.ts`: `getDigestByDate`, `listDigests`, `createDigest(date, model, candidates, entries[])` (у позиций `added_at TEXT NOT NULL` = сейчас), `appendToDigest(date, main[], near[])` (дописать `main` с `position` после текущего максимума и `added_at` = сейчас, удалить и заменить `near`, при ≥ 1 новой `main` и `viewed_at` не NULL — `viewed_at = NULL`; сводка не удаляется), `markEntryOpened(digestId, itemId)`, `markDigestViewed(id)`, `listEntries(digestId)` с полями материала, реакции и звезды
- [X] T010 [P] `desktop/src/db/queries/digestReactions.ts`: `setReaction(itemId, 1 | -1 | null)`, `recentReactions(limit = 15)` по `created_at DESC` раздельно для 1 и -1 с заголовками, `dislikeStreaksBySource()` (подряд идущие дизлайки по `source`, вернуть N ≥ 3), `toggleSaved(itemId)`, `listSaved()`, `banDomain(domain)`, `unbanDomain(domain)`, `listBans()`
- [X] T011 [P] Rust: команды `save_digest_preview(name: String, data: Vec<u8>) -> Result<String, String>` и `prune_digest_previews(names: Vec<String>) -> Result<(), String>` по образцу `save_media`/`delete_media` в `desktop/src-tauri/src/lib.rs` (папка `app_data_dir/digest-cache/`), регистрация в `invoke_handler`; `cargo check` при остановленном `pnpm tauri dev`; затем закрыть rust-analyzer
- [X] T012 [P] `desktop/src/lib/paths.ts`: `previewSrc(name)` по образцу `mediaSrc`, каталог `digest-cache` инициализируется в `initPaths`
- [X] T013 Режим: `ViewMode` += `"digest"` в `desktop/src/lib/mode.ts`; `desktop/src/pages/DigestPage.tsx` (пока пустое состояние «Сводки ещё нет»); `PAGES.digest` в `desktop/src/App.tsx`; пункт `{ value: "digest", label: "Сводка", icon: Newspaper }` после «Дни рождения» в `DESTINATIONS` (`desktop/src/components/nav/NavigationRail.tsx:15`)

**Checkpoint**: `npx tsc --noEmit` зелёный, раздел открывается, таблицы созданы. Коммит фазы.

---

## Phase 3: User Story 1 — сбор сегодняшней сводки (Priority: P1) 🎯 MVP, часть «без интерфейса»

**Goal**: тихий ежедневный сбор, отбор одним запросом, сводка в БД, тост, догон, пункт трея.

**Independent Test**: «Собрать сейчас» из dev-консоли (`window.__digestCollect` только в DEV) → в БД сводка с ≤ 12 `main` и ≤ 8 `near`, тост «Сводка готова, N материалов»; после закрытия и запуска в прошлое время — ровно одна сводка за день.

- [X] T014 [P] [US1] `desktop/src/lib/digest/pick.ts` — чистые функции без импортов Tauri и `@/`: `normalize`, `dedupe`, `withinWindow(items, hours)`, `extractJson`, `resolvePicks`, `trimVerdict` (`VERDICT_TAIL`) — порт `digest.mjs:123–260` Cairn один в один; `topicsFromInterests(text)` (метка = текст до первого `:`, иначе первые 3 слова, ≤ 24 символов, без дублей, «Любопытное» последней, если нет метки на это слово); `buildPrompt(input)` по `contracts/model-io.md` (текст `rank()` `digest.mjs:166–203` дословно + блоки «Раньше брал / Раньше отклонял / Источники…», темы из `topicsFromInterests`, `near`); `parseSelection(text, candidates, maxItems)` → `{ main: [{index, why, topic}], near: [{index}] }` с правилами 1–6 из контракта. Скрипт `desktop/scripts/digest-selftest.ts` — порт `selftest()` (`digest.mjs:312`) плюс проверки `topicsFromInterests` на интересах Cairn (5 меток, последняя «Любопытное и необычное»), `topic` вне списка → последняя метка, дубль между `picks` и `near`, обрезка до `maxItems`; добавить `node scripts/digest-selftest.ts` в скрипт `check` `desktop/package.json`
- [X] T015 [P] [US1] `desktop/src/lib/digest/sources.ts`: `fromRss({url, encoding})` (plugin-http `fetch`, `arrayBuffer` + `TextDecoder(encoding ?? "utf-8")`, `DOMParser` RSS 2.0 и Atom, `enclosure`/`media:content`/`media:thumbnail` → `image_url`), `fromHackerNews(min)`, `fromReddit(subs, take)` (один запрос `r/a+b/top.rss?t=day`, браузерный UA), `fromGithub(repo)`; таймаут 20 с; подписи `SOURCE_NAMES`; `blurb` до 280 (GitHub 400) символов — по research R2–R3
- [X] T016 [P] [US1] `desktop/src/lib/digest/previews.ts`: для отобранных `main` без `preview_file` — картинка из `image_url`, иначе `og:image` со страницы (`DOMParser` `text/html`, таймаут 8 с, без повторов) → байты → `invoke("save_digest_preview")` → `setPreview`; ошибка = без превью
- [X] T017 [US1] `desktop/src/lib/digest/collect.ts`: `collectDigest({ manual })` — ключ задан? → источники параллельно (`Promise.allSettled`, состояние каждого через `digestSources.ts`) → `insertCandidates` → `freshCandidates` в окне `digest_window_hours` → `buildPrompt` с реакциями и сериями дизлайков → один POST OpenRouter через `lib/openrouter.ts`, модель `digestModelStore` → `parseSelection` → сводки за сегодня нет: `createDigest`, есть: `appendToDigest` (добор, кандидаты без уже стоящих в сводке, правило 7 `contracts/model-io.md`) → превью → тост (при доборе — только если добавлено ≥ 1, текст «Добавлено в сводку: N»); ошибки пишут `digest_last_error`/`digest_last_attempt_at` в `settings`, сводку не создают, у плановой попытки увеличивают `digest_attempts_count` (с `digest_attempts_date` = сегодня), у ручной — нет; пусто → `digest_last_error = "Свежего ничего не нашлось"` / «Нового не нашлось» при доборе (depends on T014–T016)
- [X] T018 [P] [US1] `desktop/src/lib/digest/stores.ts`: `digestModelStore` (`trail.digest.model`, дефолт `google/gemini-2.5-flash`), `notifyDigestStore` (`trail.notifyDigest`, `"1"`), `digestUnseenStore` (true, пока у сводки за сегодня `viewed_at` NULL), `digestRunStore` (`idle | running | error` + текст) — все на `useSyncExternalStore`
- [X] T019 [US1] `desktop/src/lib/digest/scheduler.ts`: `useDigestScheduler()` по образцу `useAutoBackup` (`lib/backup.ts:67`) — запуск при старте и `setInterval` 5 мин; «пора» = нет сводки за сегодня ∧ локальное время ≥ `digest_time` (дефолт `09:00`) ∧ `digestRunStore` не `running` ∧ (`digest_attempts_date` ≠ сегодня ∨ `digest_attempts_count` < 3) ∧ с `digest_last_attempt_at` неудачной попытки прошло ≥ 15 мин; счётчик в `settings` переживает перезапуск, со сменой даты сбрасывается; нет ключа — попытка не засчитывается; подключить в `App()` (`desktop/src/App.tsx`)
- [X] T020 [US1] Тост: экспортировать `winToast` из `desktop/src/lib/notifications.ts`; после успешного сбора при `notifyDigestStore === "1"` — `kind: "digest"`, `id: digest.id`, «Сводка готова», «N материалов», без кнопок; в `desktop/src/components/events/RemindersProvider.tsx:80` ветка `payload.kind === "digest"` → `modeStore.set("digest")` и выход
- [X] T021 [US1] Трей: пункт `MenuItem::with_id(app, "digest", "Сводка", true, None::<&str>)` между «Открыть» и «Добавить напоминание» в `setup_tray` (`desktop/src-tauri/src/lib.rs:~255`), по клику `show_main(app)` + `app.emit("open-digest", ())`; во фронте `listen("open-digest")` → `modeStore.set("digest")` (в `DigestProvider` T030 или `App.tsx`); `cargo check`, затем закрыть rust-analyzer
- [X] T022 [US6] `desktop/src/lib/digest/seed.ts`: при `digest_seeded` ≠ `1` — источники из `cairn-seed.json` (`rss` строки и `{url, encoding}`, `reddit.subs`, `github`, одна строка `hn`), настройки `digest_interests`/`digest_avoid` (массивы Cairn → строки через `\n`), `digest_max_items`, `digest_window_hours`, `digest_hn_min_points`, `digest_reddit_take`; `seen` → `digest_items` (`imported = 1`, `title = ''`, `source = 'Cairn'`, `found_at` = сейчас, `INSERT OR IGNORE`); затем `digest_seeded = 1`; вызывать до первого сбора

**Checkpoint**: Independent Test выше пройден, `node scripts/digest-selftest.ts` зелёный. Коммит фазы.

---

## Phase 4: Стенды интерфейса (блокирует фазы 5–9)

**Goal**: выбрать вид четырёх поверхностей через глобальную `/redesign-stand` до кода. Паспорт — раздел «Стенды» CLAUDE.md Trail, тексты — настоящие кандидаты и сводка из `%APPDATA%\com.stillmvd.trail\timeline.db` (`mode=ro`), эталон скелета — последний стенд в `.planning/sketches/`.

- [ ] T023 Стенд `.planning/sketches/004-digest-card/` — карточка: превью/заглушка `CoverPlaceholder`, заголовок, источник, дата, `why`, лайк/дизлайк/звезда, состояния «новая / просмотренная / выбрана клавиатурой (`bg-surface-active`, без рамок и колец) / лайк / дизлайк / без картинки», группировка по темам
- [ ] T024 Стенд `.planning/sketches/005-digest-header/` — шапка сводки: дата, счётчики, «Отметить просмотренной», «Собрать сейчас», поле поиска раздела (без подсветки фокуса), строка «Было близко: N» свёрнутая/раскрытая, состояния «идёт сбор / ошибка / пусто / нет ключа / нового не нашлось», группа добора «добавлено в ЧЧ:ММ»
- [ ] T025 Стенд `.planning/sketches/006-digest-archive/` — список прошлых сводок (новая выделена, просмотренные) и «Сохранённое»; где живёт архив (колонка / переключатель) — выбирается на стенде
- [ ] T026 Стенд `.planning/sketches/007-digest-settings/` — экран «Сводка» в Настройках: интересы/антиинтересы, источники по образцу `CategoryManager`/`MarkTypeManager` (выбор на всю ширину шторки, без модалок поверх), лимиты, время, модель, «Ключ OpenRouter», сроки, баны, панель здоровья
- [ ] T027 Записать выбор каждого стенда в «Журнал стендов» `design-system/REDESIGN-MAP.md` и передать решения в задачи фаз 5–9 (если стенд меняет состав компонентов — поправить tasks.md)

**Checkpoint**: все четыре стенда выбраны пользователем.

---

## Phase 5: User Story 2 — карточки и чтение (Priority: P1)

**Goal**: сводка карточками по темам, открытие в браузере = просмотрено, «Было близко», клавиатура.

**Independent Test**: открыть сводку, пройти j/k, Enter открывает браузер и помечает карточку; «Было близко: N» раскрывается.

- [x] T028 [US2] `desktop/src/components/digest/DigestCard.tsx` по выбору стенда 004: превью `previewSrc` или `CoverPlaceholder`, заголовок, источник, дата публикации (`date-fns`, по-русски), `why`; клик → `openUrl` (`@tauri-apps/plugin-opener`) + `markEntryOpened`; spring `bounce: 0`, `active:scale-[0.96]`
- [x] T029 [P] [US2] `desktop/src/components/digest/NearList.tsx`: свёрнутая строка «Было близко: N» → заголовки-ссылки (`openUrl`), без превью и `why`; раскрытие — только `transform`/`opacity`
- [x] T030 [US2] `desktop/src/components/digest/DigestProvider.tsx`: контекст — список сводок, текущая сводка, позиции, реакции, звёзды, CRUD через `db/queries/digest*.ts`, обновление `digestUnseenStore`; слушатель `open-digest`
- [x] T031 [US2] `desktop/src/components/digest/DigestView.tsx` + `desktop/src/pages/DigestPage.tsx`: группы по `topic` в порядке `topicsFromInterests(digest_interests)` (порядок интересов, «Любопытное» последней), внутри — по `position`; позиции добора (`added_at` позже `digests.created_at` > 1 мин) — внутри своих тем, в подзаголовке группы «· N новых» (стенд 005, добор C); пустые состояния по стенду 005
- [x] T032 [US2] `desktop/src/components/digest/useDigestKeys.ts`: по `KeyboardEvent.code` вне полей ввода — `KeyJ`/`KeyK` следующая/предыдущая (через темы), `Enter` открыть, `KeyL` лайк, `KeyD` дизлайк, `KeyS` звезда; выбранная карточка — `bg-surface-active`, прокрутка в видимую область

**Checkpoint**: Independent Test пройден. Коммит фазы.

---

## Phase 6: User Story 1 — интерфейс готовности (Priority: P1)

**Goal**: шапка, «Собрать сейчас», точка в rail.

**Independent Test**: точка горит, пока сегодняшняя не просмотрена; «Собрать сейчас» при существующей сводке дописывает новые материалы группой «добавлено в ЧЧ:ММ» без вопросов; добор в просмотренную сводку возвращает точку.

- [x] T033 [US1] `desktop/src/components/digest/DigestHeader.tsx` по стенду 005: дата, счётчики, «Собрать сейчас» (`collectDigest({ manual: true })`, без подтверждения: при сводке за сегодня это добор), «Отметить просмотренной», состояния `digestRunStore` и `digest_last_error` (в т.ч. «Нет ключа OpenRouter» со ссылкой в Настройки)
- [x] T034 [US1] Точка на пункте «Сводка» в `desktop/src/components/nav/NavigationRail.tsx` по `digestUnseenStore` (небольшой кружок `amber` в углу иконки; без рамок)

**Checkpoint**: MVP — US1 + US2 целиком. Коммит фазы.

---

## Phase 7: User Story 3 — лайки, дизлайки, бан домена (Priority: P2)

**Goal**: реакции влияют на отбор, бан отсекает домен до отбора.

**Independent Test**: дизлайкнуть 3 карточки одного источника и забанить домен → следующий сбор без домена, в промпте блоки «брал/отклонял» и серия источника.

- [x] T035 [US3] Лайк/дизлайк на `DigestCard.tsx` (повтор снимает, `setReaction(itemId, null)`); дизлайк = просмотрено (`markEntryOpened`)
- [x] T036 [US3] Контекстное меню карточки (`desktop/src/components/ui/ContextMenu.tsx`): «Больше не показывать этот домен» → `banDomain(domain)`, карточки домена в текущей сводке гаснут
- [x] T037 [US3] Проверить, что `collect.ts` передаёт в `buildPrompt` `recentReactions(15)` и `dislikeStreaksBySource()`, а `freshCandidates` исключает `digest_bans`; в DEV — лог промпта в консоль

**Checkpoint**: Independent Test пройден. Коммит фазы.

---

## Phase 8: User Story 4 — архив, просмотренность, «Сохранённое» (Priority: P2)

**Goal**: архив сводок, авто-просмотр, закладки, поиск раздела, чистка по срокам.

**Independent Test**: отметить все `main` → сводка просмотрена, точка гаснет; звезда → «Сохранённое» переживает чистку сводки; поиск раздела находит прошлые материалы, общий Ctrl+F — нет.

- [x] T038 [US4] Авто-просмотр: после `markEntryOpened`/дизлайка, если у всех `main`-позиций есть `opened_at` или реакция -1 → `markDigestViewed` и обновить `digestUnseenStore` (`DigestProvider.tsx`)
- [ ] T039 [US4] `desktop/src/components/digest/DigestArchive.tsx` по стенду 006: список сводок (новая выделена `bg-surface-active`), переключение сводки, «Сохранённое» (`listSaved`); звезда на карточке → `toggleSaved`
- [x] T040 [US4] Поиск раздела: поле в `DigestHeader.tsx` → `searchItems(query)`; `desktop/src/components/search/SearchHost.tsx:26–29` не перехватывает `/` и Ctrl+F при `mode === "digest"`, раздел фокусирует своё поле
- [x] T041 [US4] `desktop/src/lib/digest/prune.ts`: после каждого успешного сбора — порядок из `data-model.md` «Чистка»: сводки старше `digest_keep_digests_days` (365) → позиции и сводки; кандидаты старше `digest_keep_candidates_days` (60) без позиций, звезды и реакции; превью старше `digest_keep_previews_days` (90) → `prune_digest_previews` + `preview_file = NULL`; затем проход по сиротам: новая Rust-команда `list_digest_previews() -> Vec<String>` (имена файлов `digest-cache/`) в `desktop/src-tauri/src/lib.rs`, всё, чего нет среди `digest_items.preview_file`, удалить `prune_digest_previews`

**Checkpoint**: Independent Test пройден. Коммит фазы.

---

## Phase 9: User Story 5 — настройки и здоровье источников (Priority: P2)

**Goal**: экран «Сводка» в Настройках.

**Independent Test**: добавить битую ленту → в здоровье ошибка, сводка собрана из остальных; снять бан → домен снова в отборе.

- [ ] T042 [P] [US5] `desktop/src/components/settings/DigestSourceManager.tsx` + `DigestSourceForm.tsx` по стенду 007 и образцу `CategoryManager`/`MarkTypeManager`: RSS (адрес, кодировка), сабреддиты, GitHub-репо, включить/выключить, удалить (`rust` только у удаления)
- [ ] T043 [P] [US5] `desktop/src/components/settings/DigestSettingsPanel.tsx`: интересы и антиинтересы (`Textarea`, свободный текст; под интересами одна строка «Темы сводки следуют за интересами: метка — текст до двоеточия»), `digest_max_items` («за один сбор»), `digest_window_hours`, `digest_hn_min_points`, `digest_reddit_take` («сколько брать из топа дня, всего»), `digest_time` (`TimePicker`), модель, «Ключ OpenRouter» (общий `openRouterKeyStore`; в `ImageGenPanel` подпись поля тоже «Ключ OpenRouter»), сроки хранения, выключатель тоста `notifyDigestStore`
- [ ] T044 [P] [US5] `desktop/src/components/settings/DigestHealthPanel.tsx`: по источнику — жив/сбой, `last_error` + время, `last_count`, доля попаданий в сводки (из `digest_entries` за 30 дней)
- [ ] T045 [P] [US5] `desktop/src/components/settings/DigestBansPanel.tsx`: список `digest_bans`, «Разбанить»
- [ ] T046 [US5] Секция «Сводка» в `desktop/src/pages/SettingsPage.tsx` со всеми панелями

**Checkpoint**: Independent Test пройден. Коммит фазы.

---

## Phase 10: Polish & Cross-Cutting

- [ ] T047 Прогнать `specs/001-daily-digest/quickstart.md` целиком (сценарии 1–9) в `pnpm tauri dev`
- [ ] T048 `pnpm run check` из `desktop/` (tsc, selftest, clippy `-D warnings`, cargo test) зелёный
- [ ] T049 [P] Обновить CLAUDE.md Trail (локальный, в gitignore): режим «Сводка» в «Режимы просмотра», таблицы `digest_*` в «Данные», `lib/digest/` и `components/digest/` в «Архитектура», раздел про сбор и ключ OpenRouter; README — строка о разделе
- [ ] T050 Сообщить cairn-15, что раздел готов, — папку Cairn удаляет он после пары дней работы

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 (блокирует всё) → Phase 3 (US1 сбор) → Phase 4 (стенды, нужны реальные данные) →
  Phase 5 (US2) → Phase 6 (US1 UI) → Phases 7, 8, 9 (US3, US4, US5 — независимы между собой, но правят
  общие `DigestCard`/`DigestProvider`, поэтому последовательно) → Phase 10.
- US6 (T022) живёт в Phase 3: импорт нужен до первого сбора.
- Внутри Phase 3: T014, T015, T016, T018 параллельно → T017 → T019, T020, T021.

## Parallel Example

```text
Phase 2: T007, T008, T009, T010, T011, T012 — разные файлы, после T005
Phase 3: T014 (pick.ts + selftest), T015 (sources.ts), T016 (previews.ts), T018 (stores.ts)
Phase 9: T042, T043, T044, T045 — отдельные панели, затем T046
```

## Implementation Strategy

- **MVP**: Phases 1–6 — сводка собирается сама, читается карточками, тост и точка работают.
- Дальше инкрементами: US3 (обучение) → US4 (архив) → US5 (настройки); каждая фаза — отдельный коммит и
  проверка своим Independent Test.
- Без субагентов на одни и те же файлы параллельно: `DigestCard.tsx`/`DigestProvider.tsx` правятся в фазах 5–8 по очереди.
