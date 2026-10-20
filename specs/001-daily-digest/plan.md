# Implementation Plan: Раздел «Сводка» — ежедневный новостной дайджест

**Branch**: `001-daily-digest` | **Date**: 2026-10-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-daily-digest/spec.md`

## Summary

Седьмой режим Trail «Сводка» заменяет Telegram-бота Cairn. Сбор и отбор целиком во фронте на TS
(`desktop/src/lib/digest/`): источники через `@tauri-apps/plugin-http`, RSS — `DOMParser` + `TextDecoder`,
отбор — один запрос OpenRouter с портом промпта и сверки Cairn. Данные — новые таблицы в SQLite через
`db/queries/digest*.ts`, превью — кеш на диске вне бэкапа. Расписание — хук по образцу `useAutoBackup`.
Интерфейс (карточка, шапка сводки, архив, экран настроек) проходит стенды `/redesign-stand` до реализации.

## Technical Context

**Language/Version**: TypeScript 5.8 (React 19, Vite 7); Rust 2021 (Tauri 2.12) — две команды кеша превью

**Primary Dependencies**: уже установленные `@tauri-apps/plugin-http`, `plugin-sql`, `plugin-opener`, `plugin-notification`,
`motion`, `lucide-react`, `date-fns`. Новых зависимостей нет (research R1, R2)

**Storage**: SQLite `timeline.db` (таблицы `digest_*`, `digests`), `settings` для настроек, localStorage для ключа
OpenRouter и модели, папка `%APPDATA%\com.stillmvd.trail\digest-cache\` для превью (research R5)

**Testing**: `npx tsc --noEmit`; `node scripts/digest-selftest.ts` (чистые функции отбора, порт `selftest()` Cairn);
`cargo check`; ручные сценарии `quickstart.md`. Тест-раннера в проекте нет и не добавляется

**Target Platform**: Windows 11, WebView2, приложение в трее

**Project Type**: desktop-app (Tauri 2)

**Performance Goals**: сводка готова ≤ 2 мин после времени сбора; опрос источников параллельно с таймаутом 20 с
на источник (как Cairn), `og:image` — 8 с на страницу, только для отобранных

**Constraints**: один запрос к модели на прогон; сбор без видимого процесса; одна сводка в день;
секреты не в `settings` (бэкап); правила конституции I–V

**Scale/Scope**: ~16 источников, ~300 кандидатов в день, ≤ 12 + 8 позиций в сводке, хранение год / 60 / 90 дней

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Как выполняется | Статус |
|---|---|---|
| I. Данные через db/queries | новые `db/queries/digestSources.ts`, `digestItems.ts`, `digests.ts`, `digestReactions.ts`; схема — `SCHEMA_SQL` без `;`/`--` внутри, `CREATE … IF NOT EXISTS`; дедуп `INSERT OR IGNORE`; чистка явная (R8) | ✅ |
| II. Внешние сторы | `digestUnseenStore`, `digestRunStore` (идёт сбор / ошибка), `notifyDigestStore`, `digestModelStore` через `useSyncExternalStore`; провайдер `DigestProvider` с CRUD; без `setState` в эффектах | ✅ |
| III. Визуальный язык | 4 стенда до реализации; выбранная карточка — `bg-surface-active`; поиск раздела без подсветки фокуса; настройки источников — экран на всю ширину шторки, без модалок; `rust` только в «Удалить источник» и ошибках здоровья; акцент — только «Собрать сейчас» в пустом состоянии / «Отметить просмотренной» (выбор на стенде) | ✅ |
| IV. Движение | раскрытие «Было близко» и появление карточек — spring `bounce: 0`, только `transform`/`opacity`; `active:scale-[0.96]` | ✅ |
| V. Код и тексты | без комментариев, UI по-русски, `@/` алиас | ✅ |
| Ограничения платформы | ключ OpenRouter в localStorage (общий с картинками), scope http расширен осознанно (R4) | ✅ |

Re-check после Phase 1: нарушений нет, Complexity Tracking пуст.

## Project Structure

### Documentation (this feature)

```text
specs/001-daily-digest/
├── plan.md              # этот файл
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── model-io.md      # запрос и ответ модели отбора
│   └── app-integration.md  # режим, команды Rust, трей, тост, сеть, клавиши, ключ
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code

```text
desktop/
├── scripts/
│   └── digest-selftest.ts          # node scripts/digest-selftest.ts, входит в pnpm run check
├── src/
│   ├── App.tsx                     # PAGES.digest, useDigestScheduler()
│   ├── lib/
│   │   ├── mode.ts                 # ViewMode += "digest"
│   │   ├── openrouter.ts           # postJson + openRouterKeyStore (вынесены из imageGen.ts)
│   │   ├── imageGen.ts             # импортирует из openrouter.ts
│   │   ├── paths.ts                # previewSrc()
│   │   ├── notifications.ts        # winToast экспортируется для сводки
│   │   └── digest/
│   │       ├── pick.ts             # чистые функции: normalize, dedupe, withinWindow, extractJson, resolvePicks, trimVerdict, buildPrompt
│   │       ├── sources.ts          # fromRss / fromHackerNews / fromReddit / fromGithub
│   │       ├── previews.ts         # картинка из ленты или og:image → save_digest_preview
│   │       ├── collect.ts          # прогон: источники → кандидаты → модель → сводка → тост
│   │       ├── scheduler.ts        # useDigestScheduler, digestRunStore
│   │       ├── stores.ts           # digestUnseenStore, digestModelStore, notifyDigestStore
│   │       ├── prune.ts            # чистка по срокам
│   │       ├── seed.ts             # разовый импорт sources.json / seen.json Cairn
│   │       └── cairn-seed.json     # снимок sources.json + seen.json (передаёт cairn-15)
│   ├── db/
│   │   ├── schema.ts               # + digest-таблицы
│   │   └── queries/
│   │       ├── digestSources.ts
│   │       ├── digestItems.ts
│   │       ├── digests.ts
│   │       └── digestReactions.ts  # реакции, сохранённое, баны
│   ├── pages/DigestPage.tsx
│   ├── components/
│   │   ├── nav/NavigationRail.tsx  # пункт «Сводка» + точка
│   │   ├── search/SearchHost.tsx   # не перехватывать / и Ctrl+F в режиме digest
│   │   ├── events/RemindersProvider.tsx  # kind === "digest"
│   │   ├── digest/
│   │   │   ├── DigestProvider.tsx  # контекст: сводки, позиции, реакции, CRUD
│   │   │   ├── DigestView.tsx      # раскладка: архив + сводка
│   │   │   ├── DigestHeader.tsx    # дата, счётчики, «Отметить просмотренной», «Собрать сейчас», поиск
│   │   │   ├── DigestCard.tsx      # превью, заголовок, источник, дата, why, реакции, звезда, ПКМ
│   │   │   ├── NearList.tsx        # «Было близко: N»
│   │   │   ├── DigestArchive.tsx   # список сводок + «Сохранённое»
│   │   │   └── useDigestKeys.ts    # j/k/Enter/L/D/S
│   │   └── settings/
│   │       ├── DigestSettingsPanel.tsx   # интересы, лимиты, время, модель, ключ, сроки
│   │       ├── DigestSourceManager.tsx   # по образцу CategoryManager/MarkTypeManager
│   │       ├── DigestSourceForm.tsx
│   │       ├── DigestHealthPanel.tsx
│   │       └── DigestBansPanel.tsx
│   └── pages/SettingsPage.tsx      # секция «Сводка»
└── src-tauri/
    ├── src/lib.rs                  # save_digest_preview, prune_digest_previews, пункт трея «Сводка»
    ├── tauri.conf.json             # assetProtocol.scope += $APPDATA/digest-cache/**
    └── capabilities/default.json   # http allow += https://*/*
```

**Structure Decision**: всё внутри существующего `desktop/`; логика сбора — `lib/digest/` (как `lib/imageGen.ts`),
данные — `db/queries/digest*.ts`, UI — `components/digest/` и `components/settings/Digest*`.

## Фазы реализации (порядок для tasks.md)

1. **Фундамент**: вынос `lib/openrouter.ts`; `ViewMode` + пустая `DigestPage` + пункт rail; схема БД одной фазой
   (все таблицы `data-model.md`) + проверка `PRAGMA foreign_keys` при первой инициализации (лог результата,
   чистка явная независимо от ответа); `db/queries/digest*.ts`; права `https://*/*`, assetProtocol, Rust-команды превью.
2. **Сбор и отбор (US1 ядро)**: `pick.ts` + selftest; `sources.ts`; `collect.ts`; `previews.ts`; `scheduler.ts`;
   тост + ветка `kind === "digest"`; пункт трея; импорт Cairn (`seed.ts`).
3. **Стенды** (`/redesign-stand`, `.planning/sketches/004-digest-card/`, `005-digest-header/`,
   `006-digest-archive/`, `007-digest-settings/`): тексты — настоящие кандидаты первой сводки из БД
   (`mode=ro`); запись выбора в журнал стендов `design-system/REDESIGN-MAP.md`. Без выбора по стенду
   соответствующий компонент не реализуется.
4. **Интерфейс сводки (US2, US1 UI)**: `DigestProvider`, `DigestView`, `DigestCard`, `NearList`, `DigestHeader`,
   точка в rail, клавиши, поиск раздела, `SearchHost` в режиме digest.
5. **Обучение (US3)**: реакции, бан домена в `ContextMenu`, блоки «брал/отклонял» и статистика источников в промпте.
6. **Архив (US4)**: `DigestArchive`, авто-просмотр, «Сохранённое», чистка `prune.ts`.
7. **Настройки (US5)**: `DigestSettingsPanel`, `DigestSourceManager/Form`, `DigestHealthPanel`, `DigestBansPanel`,
   секция в `SettingsPage`.
8. **Полировка**: `quickstart.md` целиком, `pnpm run check`, раздел «Сводка» в CLAUDE.md Trail (архитектура,
   данные, режимы), обновление README при необходимости.

## Риски

- **Reddit** режет неброузерный UA и иногда отдаёт 429 — источник падает, остальные собираются (FR-011).
- **Таймеры WebView2 в скрытом окне** могут замедляться; интервал 5 мин и догон при старте покрывают это.
- **`og:image`** со страниц с антиботом не загрузится — заглушка (FR-019).
- **Модель промахивается индексом** — сверка по эху (FR-015), перенесена из Cairn с тестом.

## Complexity Tracking

Нарушений конституции нет.
