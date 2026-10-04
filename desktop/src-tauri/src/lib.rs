use std::fs;
use tauri::Manager;

#[tauri::command]
fn save_media(app: tauri::AppHandle, name: String, data: Vec<u8>) -> Result<String, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("media");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::write(dir.join(&name), data).map_err(|e| e.to_string())?;
    Ok(name)
}

#[tauri::command]
fn delete_media(app: tauri::AppHandle, name: String) -> Result<(), String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("media")
        .join(&name);
    let _ = fs::remove_file(path);
    Ok(())
}

// WebView2 по умолчанию перехватывает акселераторы браузера (Ctrl+F, Ctrl+P, F5,
// caret browsing) до web-контента — в кастомном UI они не нужны и ломают наш Ctrl+F.
#[cfg(target_os = "windows")]
fn disable_browser_accelerator_keys(window: &tauri::WebviewWindow) {
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings3;
    use windows::core::Interface;

    let _ = window.with_webview(|webview| unsafe {
        if let Ok(core) = webview.controller().CoreWebView2() {
            if let Ok(settings) = core.Settings() {
                if let Ok(s3) = settings.cast::<ICoreWebView2Settings3>() {
                    let _ = s3.SetAreBrowserAcceleratorKeysEnabled(false);
                }
            }
        }
    });
}

// Бэкап: снимок БД делает JS (VACUUM INTO — консистентная копия при открытом коннекте),
// Rust получает готовый файл и пакует его вместе с media/ в zip.
#[tauri::command]
fn create_backup(
    app: tauri::AppHandle,
    db_snapshot: String,
    dest: String,
    keep: usize,
) -> Result<String, String> {
    use std::io::{Read, Write};
    use zip::write::SimpleFileOptions;

    let snapshot = std::path::PathBuf::from(&db_snapshot);
    let result = (|| -> Result<String, String> {
        if let Some(parent) = std::path::Path::new(&dest).parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let file = fs::File::create(&dest).map_err(|e| e.to_string())?;
        let mut zip = zip::ZipWriter::new(file);
        let opts = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        let mut buf = Vec::new();
        fs::File::open(&snapshot)
            .and_then(|mut f| f.read_to_end(&mut buf))
            .map_err(|e| format!("снимок БД: {e}"))?;
        zip.start_file("timeline.db", opts).map_err(|e| e.to_string())?;
        zip.write_all(&buf).map_err(|e| e.to_string())?;

        let media = app
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("media");
        if media.is_dir() {
            for entry in fs::read_dir(&media).map_err(|e| e.to_string())? {
                let entry = entry.map_err(|e| e.to_string())?;
                if !entry.path().is_file() {
                    continue;
                }
                let name = entry.file_name().to_string_lossy().to_string();
                let mut data = Vec::new();
                fs::File::open(entry.path())
                    .and_then(|mut f| f.read_to_end(&mut data))
                    .map_err(|e| e.to_string())?;
                zip.start_file(format!("media/{name}"), opts)
                    .map_err(|e| e.to_string())?;
                zip.write_all(&data).map_err(|e| e.to_string())?;
            }
        }
        zip.finish().map_err(|e| e.to_string())?;
        Ok(dest.clone())
    })();

    let _ = fs::remove_file(&snapshot);
    let created = result?;
    rotate_backups(&dest, keep)?;
    Ok(created)
}

// Оставляем keep свежих архивов; 0 — ротация выключена.
fn rotate_backups(dest: &str, keep: usize) -> Result<(), String> {
    if keep == 0 {
        return Ok(());
    }
    let dir = match std::path::Path::new(dest).parent() {
        Some(d) => d.to_path_buf(),
        None => return Ok(()),
    };
    let mut backups: Vec<_> = fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            name.starts_with("timeline-backup-") && name.ends_with(".zip")
        })
        .collect();
    if backups.len() <= keep {
        return Ok(());
    }
    backups.sort_by_key(|e| e.file_name());
    for old in &backups[..backups.len() - keep] {
        let _ = fs::remove_file(old.path());
    }
    Ok(())
}

// Восстановление затирает боевые файлы, поэтому вызывающая сторона обязана подтвердить
// действие у пользователя и перезапустить приложение — коннект к старой БД уже невалиден.
#[tauri::command]
fn restore_backup(app: tauri::AppHandle, zip_path: String) -> Result<(), String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let file = fs::File::open(&zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("не архив: {e}"))?;

    if archive.by_name("timeline.db").is_err() {
        return Err("в архиве нет timeline.db — это не бэкап Trail".into());
    }

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let Some(rel) = entry.enclosed_name() else {
            continue;
        };
        let name = rel.to_string_lossy().replace('\\', "/");
        if name != "timeline.db" && !name.starts_with("media/") {
            continue;
        }
        let out = data_dir.join(&rel);
        if let Some(parent) = out.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut dst = fs::File::create(&out).map_err(|e| e.to_string())?;
        std::io::copy(&mut entry, &mut dst).map_err(|e| e.to_string())?;
    }

    // WAL/SHM от прежней БД противоречат восстановленному файлу.
    let _ = fs::remove_file(data_dir.join("timeline.db-wal"));
    let _ = fs::remove_file(data_dir.join("timeline.db-shm"));
    Ok(())
}

#[cfg(windows)]
#[derive(serde::Deserialize)]
struct NotifyButton {
    label: String,
    action: String,
}

#[cfg(windows)]
#[derive(Clone, serde::Serialize)]
struct NotifyActivation {
    kind: String,
    id: i64,
    action: String,
}

// AppUserModelID берётся из установленной копии: у запуска из target/* его нет в реестре,
// и тост с таким id молча не показывается — для отладки подменяем на powershell.
#[cfg(windows)]
fn toast_app_id(app: &tauri::AppHandle) -> String {
    let unpacked = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|dir| dir.to_path_buf()))
        .map(|dir| dir.ends_with("debug") || dir.ends_with("release"))
        .unwrap_or(true);
    if unpacked {
        tauri_winrt_notification::Toast::POWERSHELL_APP_ID.to_string()
    } else {
        app.config().identifier.clone()
    }
}

// Плагин уведомлений умеет только показать тост: у него нет кнопок и реакции на клик.
// Свой toast через WinRT даёт и то и другое, пока приложение живёт в трее.
#[cfg(windows)]
#[tauri::command]
fn notify(
    app: tauri::AppHandle,
    kind: String,
    id: i64,
    title: String,
    body: Option<String>,
    buttons: Vec<NotifyButton>,
) -> Result<(), String> {
    use tauri::Emitter;
    use tauri_winrt_notification::{Duration, Toast};

    let app_id = toast_app_id(&app);
    let mut toast = Toast::new(&app_id).title(&title).duration(Duration::Long);
    if let Some(text) = body.as_deref() {
        toast = toast.text1(text);
    }
    for button in &buttons {
        toast = toast.add_button(&button.label, &button.action);
    }

    let handle = app.clone();
    toast
        .on_activated(move |action| {
            show_main(&handle);
            let _ = handle.emit(
                "notification-action",
                NotifyActivation {
                    kind: kind.clone(),
                    id,
                    action: action.unwrap_or_else(|| "open".to_string()),
                },
            );
            Ok(())
        })
        .show()
        .map_err(|e| e.to_string())
}

const TRAY: &[u8] = include_bytes!("../icons/tray.png");

fn tray_image() -> tauri::Result<tauri::image::Image<'static>> {
    tauri::image::Image::from_bytes(TRAY)
}

fn show_main(app: &tauri::AppHandle) {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    let open = MenuItem::with_id(app, "open", "Открыть", true, None::<&str>)?;
    let add_reminder =
        MenuItem::with_id(app, "add_reminder", "Добавить напоминание", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &add_reminder, &quit])?;

    TrayIconBuilder::with_id("main")
        .icon(tray_image()?)
        .tooltip("Trail")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "add_reminder" => {
                show_main(app);
                use tauri::Emitter;
                let _ = app.emit("add-reminder", ());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
// Данные до переименования Rings → Trail лежат под старым identifier. Переносим один
// раз при старте: без этого тихое обновление поднимает приложение с пустой базой, а
// прожитая история остаётся висеть в папке старого имени.
fn migrate_legacy_app_data(app: &tauri::App) {
    let Ok(new_dir) = app.path().app_data_dir() else {
        return;
    };
    if new_dir.join("timeline.db").exists() {
        return;
    }
    let Some(old_dir) = new_dir.parent().map(|p| p.join("com.stillmvd.rings")) else {
        return;
    };
    if !old_dir.join("timeline.db").exists() {
        return;
    }
    if fs::create_dir_all(&new_dir).is_err() {
        return;
    }
    let Ok(entries) = fs::read_dir(&old_dir) else {
        return;
    };
    for entry in entries.flatten() {
        let _ = fs::rename(entry.path(), new_dir.join(entry.file_name()));
    }
}

pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main(app);
        }));
    }

    builder
        .plugin(
            // Только геометрия — без VISIBLE, иначе автостарт в трей (--minimized) восстановил бы
            // показанное окно.
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::MAXIMIZED
                        | tauri_plugin_window_state::StateFlags::FULLSCREEN,
                )
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            save_media,
            delete_media,
            create_backup,
            restore_backup,
            #[cfg(windows)]
            notify
        ])
        .setup(|app| {
            migrate_legacy_app_data(app);
            setup_tray(app)?;

            // Автостарт поднимает приложение с --minimized: живёт в трее, окно не показываем.
            if !std::env::args().any(|a| a == "--minimized") {
                show_main(app.handle());
            }

            #[cfg(target_os = "windows")]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    disable_browser_accelerator_keys(&window);
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
