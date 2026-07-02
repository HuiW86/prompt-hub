use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use tauri::{Manager, PhysicalPosition, PhysicalSize, RunEvent};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
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

// Fatal-startup handler: surface `message` in a native error dialog, then
// exit(1) once the user dismisses it. Called from setup() when the DB path
// cannot be resolved or the DB cannot be opened/migrated — a bare panic there
// happens before anything is visible, so a double-clicked .app just vanishes.
//
// Constraints that shape this implementation (verified against tauri 2.11 /
// tauri-plugin-dialog 2.7 / rfd 0.16 sources):
// - Returning Err from the setup hook is no better than panicking: tauri runs
//   setup at RunEvent::Ready and maps Err to `panic!("Failed to setup app")`,
//   equally invisible to the user. So the failure arm returns Ok(()) to keep
//   the event loop alive and lets this handler exit the app.
// - setup runs on the main thread with NSApp already running, so rfd renders
//   the dialog as a window sheet whose completion handler is delivered over
//   the main run loop. Calling blocking_show() on the main thread would park
//   that run loop and deadlock with a dialog that never appears — the dialog
//   must block a worker thread instead.
// - The sheet attaches to the main window, which is config-hidden
//   (`visible: false`); show it first so the dialog is actually visible.
// - The webview still boots and fires IPC while the dialog is up. Manage a
//   throwaway unmigrated in-memory connection so `State<AppState>` extraction
//   cannot panic; every command then fails with a recoverable SQL /
//   SchemaVersionMismatch error instead of writing anywhere real.
fn fail_startup(app: &tauri::App, message: String) {
    if let Ok(conn) = rusqlite::Connection::open_in_memory() {
        app.manage(AppState {
            conn: Mutex::new(conn),
            copy_seq: AtomicU64::new(0),
        });
    }
    if let Some(window) = app.get_webview_window("main") {
        #[cfg(desktop)]
        fit_to_active_monitor(&window);
        let _ = window.show();
    }
    let handle = app.handle().clone();
    std::thread::spawn(move || {
        handle
            .dialog()
            .message(message)
            .title("prompt-hub failed to start")
            .kind(MessageDialogKind::Error)
            .blocking_show();
        handle.exit(1);
    });
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
        // Native save/open dialogs for data export/import (PRD §7.5).
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Resolve the DB path and open+migrate. Both are fallible on a
            // user machine (missing/read-only home dir, corrupt or
            // future-schema DB file) — fail loud via dialog, not panic.
            let db_init = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to resolve the application data directory: {e}"))
                .and_then(|data_dir| {
                    let db_path = data_dir.join("prompt-hub.db");
                    repo_core::db::open_and_migrate(&db_path).map_err(|e| {
                        format!(
                            "Failed to open or migrate the database at\n{}\n\n{e}",
                            db_path.display()
                        )
                    })
                });
            let conn = match db_init {
                Ok(conn) => conn,
                Err(message) => {
                    fail_startup(app, message);
                    // Keep the event loop alive (skip shortcut/panel setup);
                    // fail_startup exits the app once the dialog is dismissed.
                    return Ok(());
                }
            };
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
            commands::get_draft,
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
            commands::set_default_alignment_phrase,
            commands::create_composition,
            commands::update_composition,
            commands::delete_composition,
            commands::reorder_compositions,
            commands::create_phrase,
            commands::update_phrase,
            commands::delete_phrase,
            commands::reorder_phrases,
            commands::create_scene,
            commands::update_scene,
            commands::delete_scene,
            commands::reorder_scenes,
            commands::create_sub_stage,
            commands::update_sub_stage,
            commands::delete_sub_stage,
            commands::reorder_sub_stages,
            commands::export_data,
            commands::import_data,
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
