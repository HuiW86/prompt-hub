use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use tauri::{Manager, PhysicalPosition, PhysicalSize, RunEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[cfg(feature = "bench")]
mod bench;
mod commands;
mod error;
#[cfg(target_os = "macos")]
pub(crate) mod macos;

use commands::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir().expect("resolve app_data_dir");
            let db_path = data_dir.join("prompt-hub.db");
            let conn = repo_core::db::open_and_migrate(&db_path).expect("open prompt-hub db");
            app.manage(AppState {
                conn: Mutex::new(conn),
                copy_seq: AtomicU64::new(0),
            });

            #[cfg(desktop)]
            {
                // Resize the main window to cover the primary monitor instead
                // of using tauri.conf.json `fullscreen: true`, which on macOS
                // creates a system fullscreen Space (independent space, no
                // alwaysOnTop, transparency disabled — incompatible with
                // spec §1.1 "全屏覆盖窗口浮于所有应用上方不抢焦点").
                if let Some(window) = app.get_webview_window("main") {
                    if let Ok(Some(monitor)) = window.primary_monitor() {
                        let size = monitor.size();
                        let pos = monitor.position();
                        let _ = window.set_size(PhysicalSize::new(size.width, size.height));
                        let _ = window.set_position(PhysicalPosition::new(pos.x, pos.y));
                    }

                    // System fullscreen Spaces are WindowServer/AppKit domains,
                    // not z-order layers. AppKit only honors NonactivatingPanel
                    // on NSPanel instances, so we isa-swizzle TaoWindow ->
                    // NSPanel once at setup. Doing it here (instead of lazily
                    // on first wake) means any pre-wake show — devtools,
                    // future emit window-created handler, command-line
                    // fallback — already sees an NSPanel. See macos.rs and
                    // ADR-008 for the rationale.
                    #[cfg(target_os = "macos")]
                    {
                        macos::apply_nonactivating_panel(&window);
                    }
                }

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
                                // Tao's set_focus() calls activateIgnoringOtherApps:
                                // which actively yanks the window back into the
                                // app's own Space, fighting the non-activating
                                // panel model. orderFrontRegardless surfaces
                                // the window without stealing app activation.
                                #[cfg(not(target_os = "macos"))]
                                let _ = window.set_focus();
                                #[cfg(target_os = "macos")]
                                {
                                    // AppKit setters are MainThreadOnly; the
                                    // global-shortcut handler runs on a worker
                                    // thread.
                                    let window = window.clone();
                                    let _ = app.run_on_main_thread(move || {
                                        macos::order_front(&window);
                                        macos::focus_view(&window);
                                    });
                                }
                            }
                        })
                        .build(),
                )?;
                app.global_shortcut().register(toggle)?;

                #[cfg(feature = "bench")]
                bench::spawn_wake_cycle(app.handle().clone());
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_phases,
            commands::list_alignment_phrases,
            commands::list_macros,
            commands::list_scenes_with_children,
            commands::list_recent_usage,
            commands::count_today_usage,
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
