<!--
Sync Impact Report
- Version change: (template) → 1.0.0
- Modified principles: все плейсхолдеры заменены
  I. Данные только через db/queries
  II. Состояние во внешних сторах
  III. Визуальный язык Trail
  IV. Единое движение
  V. Код и тексты
- Added sections: «Ограничения платформы», «Рабочий процесс»
- Removed sections: нет
- Templates: plan/spec/tasks читают конституцию при запуске, не правились
- Deferred TODOs: нет
Источники: CLAUDE.md Trail, design-system/VISUAL-STYLE.md, закреплённая память проекта.
-->
# Trail Constitution

## Core Principles

### I. Данные только через db/queries

- Доступ к SQLite — только через функции `desktop/src/db/queries/*` (обёртки над
  tauri-plugin-sql). Компоненты, хуки и `lib/` не пишут SQL сами.
- Схема — идемпотентная `SCHEMA_SQL` в `db/schema.ts` (`CREATE … IF NOT EXISTS`).
  Загрузчик режет её по `;` и отбрасывает всё после `--` в строке, поэтому внутри
  SQL нельзя `;` и `--` в литералах, триггеры не допускаются.
- Изменение существующих таблиц — только в `migrate()` (`db/database.ts`) с проверкой
  формы (`hasColumn`), повторный запуск ничего не ломает.
- Даты — `TEXT` в формате `YYYY-MM-DD`: строковое сравнение = хронологическое.

Почему: одна точка доступа к данным и миграции, которые переживают любой порядок
запусков у единственного пользователя с живой базой.

### II. Состояние во внешних сторах

- `setState` внутри `useEffect` запрещён. Внешнее состояние — сторы в `lib/`
  через `useSyncExternalStore` (`createLocalStore` и аналоги).
- Данные БД раздают провайдеры-оркестраторы с CRUD через контекст.

Почему: предсказуемые рендеры без каскадов эффектов.

### III. Визуальный язык Trail

- Цвет — только токены `--rg-*` / `--ds-*` (OKLCH) и утилиты `bg-surface-0..3`,
  `bg-surface-active`, `text-app-text`, `text-muted`, `border-line`, `amber`, `ink`,
  `rust`, `text-accent-ink`. Произвольных цветов нет; светлая тема — `[data-theme="light"]`.
- `rust` (`--ds-danger`) — ТОЛЬКО ошибка, удаление, опасное действие.
- Акцент — только у главного действия. Акцент как цвет текста или иконки —
  `--ds-accent-ink`, `--rg-amber` — только заливка.
- Радиусы и тени — только шкала `--ds-radius-*` / `--shadow-*` из `styles.css`,
  произвольных `rounded-[Npx]` нет.
- Выбранное выделяется заливкой `bg-surface-active`, без рамок, колец и точек-индикаторов.
  Поля ввода в фокусе не подсвечиваются. Выбор из списка — на всю ширину шторки,
  без модалок и оверлеев поверх неё.
- Иконки lucide: `strokeWidth` 1.75 у ≤ 24 px, 1.5 у ≥ 26 px.
- Новый или переделанный интерфейс проходит стенд вариантов (`/redesign-stand`,
  `.planning/sketches/NNN-<компонент>/`) до реализации. Смена цветов и радиусов
  редизайном не считается.

Почему: фиксированная палитра Trail и вкус автора, проверенный стендами.

### IV. Единое движение

- Анимации — spring без отскока (`{ type: "spring", bounce: 0 }`) и `--rg-ease`.
- Анимируются только `transform`, `opacity`, `filter` (и `padding`, где это описано
  в VISUAL-STYLE.md). `border-radius` между `rounded-full` и значением не анимируется.
- Интерактивные элементы — `active:scale-[0.96]`.

Почему: один язык движения во всех режимах, без рывков и перерасчёта раскладки.

### V. Код и тексты

- Комментариев в коде нет, кроме `TODO`.
- Все тексты интерфейса — на русском.
- Импорты через алиас `@/*` → `desktop/src/*`.

Почему: код самодокументируется именами; приложение для одного русскоязычного автора.

## Ограничения платформы

- Tauri 2 + React 19 + Vite 7 + Tailwind 4, Windows, pnpm-корень в `desktop/`.
- `productName` (`Trail`), `identifier` (`com.stillmvd.trail`), endpoint обновлений и
  `plugins.updater.pubkey` не меняются никогда: смена = дубль установки, потеря данных
  или конец автообновлений.
- Версия живёт только в `desktop/package.json`; релиз — `pnpm release` (tauri-ship).
- Ключи внешних сервисов — в localStorage (`createLocalStore`), не в таблице `settings`:
  `timeline.db` целиком уходит в бэкап.
- Сетевые запросы — `@tauri-apps/plugin-http` с явным scope в
  `src-tauri/capabilities/default.json`.

## Рабочий процесс

- После задачи — `npx tsc --noEmit` из `desktop/`; при правке Rust — `cargo check`
  (не при живом `pnpm tauri dev`); перед релизом — `pnpm run check`.
- Коммиты — короткий conventional на русском (`feat:` / `fix:` / `refactor:` / `chore:`
  + суть без точки), только заголовок, пофазно, пути файлов явно.
- Никаких упоминаний Claude / Anthropic / AI в коммитах, без `Co-Authored-By`.

## Governance

- Конституция выведена из CLAUDE.md Trail и `design-system/VISUAL-STYLE.md`; при
  расхождении правится источник и конституция вместе.
- Поправки — по решению автора: MAJOR — удаление или переопределение принципа,
  MINOR — новый принцип или раздел, PATCH — уточнение формулировок.
- Каждый план (`/speckit-plan`) проходит Constitution Check по пяти принципам;
  нарушение допускается только с обоснованием в Complexity Tracking.

**Version**: 1.0.0 | **Ratified**: 2026-10-20 | **Last Amended**: 2026-10-20
