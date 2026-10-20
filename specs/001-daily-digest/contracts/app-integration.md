# Contract: стыки раздела с приложением

## Режим

- `ViewMode` (`desktop/src/lib/mode.ts`) += `"digest"`; `PAGES` (`App.tsx:23`) += `digest: DigestPage`;
  `DESTINATIONS` (`components/nav/NavigationRail.tsx:15`) += `{ value: "digest", label: "Сводка", icon: Newspaper }`
  после «Дни рождения». Точка на пункте — по стору `digestUnseenStore` (true, пока у сегодняшней `viewed_at` NULL).

## Rust-команды (`desktop/src-tauri/src/lib.rs`, `invoke_handler`)

| Команда | Аргументы | Результат | Поведение |
|---|---|---|---|
| `save_digest_preview` | `name: String, data: Vec<u8>` | `String` (name) | пишет в `app_data_dir/digest-cache/`, создаёт папку |
| `prune_digest_previews` | `names: Vec<String>` | `()` | удаляет перечисленные файлы, ошибки отсутствия игнорирует |

`tauri.conf.json` → `app.security.assetProtocol.scope` += `"$APPDATA/digest-cache/**"`.
`create_backup` папку `digest-cache` не включает (не трогать: читает только `media/`).

## Трей

`setup_tray`: пункт `MenuItem::with_id(app, "digest", "Сводка", …)` между «Открыть» и «Добавить напоминание»;
по клику — `show_main(app)` + `app.emit("open-digest", ())`. Фронт: `listen("open-digest")` → `modeStore.set("digest")`.

## Уведомление

`invoke("notify", { kind: "digest", id: <digest.id>, title: "Сводка готова", body: "<N> материалов", buttons: [] })`
через существующий `winToast` (`lib/notifications.ts`), с учётом выключателя уведомлений
(новый `notifyDigestStore`, по образцу `notifyRemindersStore`, дефолт `"1"`).
Обработчик `notification-action` (`components/events/RemindersProvider.tsx:80`): `payload.kind === "digest"` →
`modeStore.set("digest")`, без перехода в напоминания.

## Сеть

`desktop/src-tauri/capabilities/default.json` → `http:default.allow` += `{ "url": "https://*/*" }`.
Заголовок `user-agent` — Reddit/страницы: браузерный (Cairn `BROWSER_UA`), остальное — `digest-bot/1.0 (personal use)`.
Ссылки открываются `openUrl` (`@tauri-apps/plugin-opener`, `opener:default`).

## Поиск и клавиши

`SearchHost` не реагирует на `/` и Ctrl+F при `mode === "digest"`; раздел перехватывает их и фокусирует своё поле.
В разделе (вне полей ввода): `KeyJ` / `KeyK` — следующая / предыдущая карточка, `Enter` — открыть,
`KeyL` — лайк, `KeyD` — дизлайк, `KeyS` — звезда.

## Ключ OpenRouter

`openRouterKeyStore` переезжает из `lib/imageGen.ts:12` в `lib/openrouter.ts` вместе с `postJson` (`imageGen.ts:249`),
имя ключа localStorage `trail.imagegen.openRouterKey` сохраняется (введённый ключ не теряется).
В UI поле подписано «Ключ OpenRouter» и в «Картинках», и в «Сводке» — это один и тот же ключ.
