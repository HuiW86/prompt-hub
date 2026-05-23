use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use tauri::{Manager, RunEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

mod commands;
mod db;
mod error;
mod models;
mod repo;

use commands::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir().expect("resolve app_data_dir");
            let db_path = data_dir.join("prompt-hub.db");
            let conn = db::open_at(&db_path).expect("open prompt-hub db");
            app.manage(AppState {
                conn: Mutex::new(conn),
                copy_seq: AtomicU64::new(0),
            });

            #[cfg(desktop)]
            {
                let toggle = Shortcut::new(Some(Modifiers::ALT), Code::Space);
                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app, _shortcut, event| {
                            if event.state() != ShortcutState::Pressed {
                                return;
                            }
                            let Some(window) = app.get_webview_window("main") else {
                                return;
                            };
                            // Bump copy_seq so any pending delayed hide from
                            // an earlier copy can't trample this toggle.
                            app.state::<AppState>()
                                .copy_seq
                                .fetch_add(1, Ordering::SeqCst);
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        })
                        .build(),
                )?;
                app.global_shortcut().register(toggle)?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_phases,
            commands::list_alignment_phrases,
            commands::list_macros,
            commands::list_scenes_with_children,
            commands::list_recent_usage,
            commands::record_usage,
            commands::hide_window,
            commands::show_window,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app, event| {
        if let RunEvent::Exit = event {
            #[cfg(desktop)]
            let _ = app.global_shortcut().unregister_all();
        }
    });
}
