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

// Cover the monitor under the cursor with the overlay. Runs on every wake (not
// just at setup) so resolution changes, display hot-plug, and the cursor's
// current screen in multi-monitor setups are all honored — otherwise the window
// stays frozen at the startup-time primary-monitor geometry. Full-screen-cover
// style A: spans the entire monitor including the macOS menu bar (monitor.size(),
// not work area).
#[cfg(desktop)]
fn fit_to_active_monitor(window: &tauri::WebviewWindow) {
    let monitor = window
        .cursor_position()
        .ok()
        .and_then(|p| window.monitor_from_point(p.x, p.y).ok().flatten())
        .or_else(|| window.current_monitor().ok().flatten())
        .or_else(|| window.primary_monitor().ok().flatten());
    if let Some(monitor) = monitor {
        let size = monitor.size();
        let pos = monitor.position();
        let _ = window.set_size(PhysicalSize::new(size.width, size.height));
        let _ = window.set_position(PhysicalPosition::new(pos.x, pos.y));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        // Auto-update (ADR-017). The check/download/install commands are driven
        // from the frontend (updaterStore) over the capability allowlist; the
        // process plugin backs relaunch() after install (#2273). The actual
        // check runs in JS off the ⌥Space wake hot path, never threatening C1.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
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
                // Cover the active monitor instead of using tauri.conf.json
                // `fullscreen: true`, which on macOS creates a system fullscreen
                // Space (independent space, no alwaysOnTop, transparency disabled
                // — incompatible with spec §1.1 "全屏覆盖窗口浮于所有应用上方不抢焦点").
                // The same fit runs on every wake (see the shortcut handler), so
                // this is just the initial geometry.
                if let Some(window) = app.get_webview_window("main") {
                    fit_to_active_monitor(&window);

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
                                // Re-fit + show + focus must all run on the main
                                // thread: AppKit setters are MainThreadOnly, and
                                // cursor/monitor queries crash when called off the
                                // main thread (tauri-apps/tauri#15170). The
                                // global-shortcut handler itself runs on a worker
                                // thread, so dispatch the whole wake onto main.
                                //
                                // fit_to_active_monitor re-fits so the overlay
                                // tracks the current display / resolution / cursor
                                // screen rather than the stale setup-time geometry.
                                //
                                // macOS uses orderFrontRegardless (macos::wake)
                                // rather than set_focus(): tao's set_focus() calls
                                // activateIgnoringOtherApps:, yanking the window
                                // into the app's own Space and fighting the
                                // non-activating panel model.
                                let window = window.clone();
                                let _ = app.run_on_main_thread(move || {
                                    fit_to_active_monitor(&window);
                                    let _ = window.show();
                                    #[cfg(not(target_os = "macos"))]
                                    let _ = window.set_focus();
                                    #[cfg(target_os = "macos")]
                                    macos::wake(&window);
                                });
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
            commands::list_modifiers,
            commands::list_compositions,
            commands::list_scenes_with_children,
            commands::list_recent_usage,
            commands::count_today_usage,
            commands::record_usage,
            commands::hide_window,
            commands::show_window,
            commands::list_drafts,
            commands::count_pending_drafts,
            commands::promote_draft,
            commands::update_draft,
            commands::discard_draft,
            commands::create_macro,
            commands::update_macro,
            commands::delete_macro,
            commands::reorder_macros,
            commands::create_modifier,
            commands::update_modifier,
            commands::delete_modifier,
            commands::reorder_modifiers,
            commands::create_alignment_phrase,
            commands::update_alignment_phrase,
            commands::delete_alignment_phrase,
            commands::reorder_alignment_phrases,
            commands::create_composition,
            commands::update_composition,
            commands::delete_composition,
            commands::reorder_compositions,
            commands::create_phrase,
            commands::update_phrase,
            commands::delete_phrase,
            commands::reorder_phrases,
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
