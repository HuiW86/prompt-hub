use std::io::Write;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;

use tauri::{Manager, PhysicalPosition, PhysicalSize, RunEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

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

// Show the overlay on the active monitor. Shared by the wake chord and the
// macOS reopen handler so both paths get identical geometry and z-order
// behaviour — an earlier version inlined this in the shortcut handler only,
// which is how clicking the Dock icon came to do nothing at all.
//
// Re-fit + show + focus must all run on the main thread: AppKit setters are
// MainThreadOnly, and cursor/monitor queries crash when called off the main
// thread (tauri-apps/tauri#15170). The global-shortcut handler runs on a worker
// thread, so dispatch the whole wake onto main.
//
// fit_to_active_monitor re-fits so the overlay tracks the current display /
// resolution / cursor screen rather than the stale setup-time geometry.
//
// macOS uses orderFrontRegardless (macos::wake) rather than set_focus(): tao's
// set_focus() calls activateIgnoringOtherApps:, yanking the window into the
// app's own Space and fighting the non-activating panel model.
#[cfg(desktop)]
fn wake_main_window(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let _ = app.run_on_main_thread(move || {
        fit_to_active_monitor(&window);
        let _ = window.show();
        #[cfg(not(target_os = "macos"))]
        let _ = window.set_focus();
        #[cfg(target_os = "macos")]
        macos::wake(&window);
    });
}

// Fatal-startup handler: surface `message` in a native error dialog, then
// exit(1). Called from setup() when the DB path cannot be resolved or the DB
// cannot be opened/migrated — a bare panic there happens before anything is
// visible, so a double-clicked .app would just vanish.
//
// Deliberately bypasses tauri-plugin-dialog and never returns to the event
// loop. The plugin cannot give us a synchronous dialog here: it dispatches
// over the event-loop proxy, so its blocking API called on the main thread
// waits for a task the blocked loop can never run. Returning Err from setup
// is no better than panicking (tauri maps it to an invisible
// `panic!("Failed to setup app")`), and returning Ok(()) to keep the loop
// alive means a half-built app — webview booting, no real AppState, no
// shortcut plugin — runs alongside the dialog. An earlier version did exactly
// that (throwaway in-memory AppState, worker thread, handle.exit(1)) and
// crashed in the RunEvent::Exit handler on dismissal because that handler
// assumes setup completed (G4 D3, exit code 101).
//
// rfd's sync show() with no parent is safe to block the main thread on for
// the targets we ship: macOS renders it out of process via
// CFUserNotificationDisplayAlert (the window belongs to UserNotificationCenter,
// so window-scoped screenshots of this app never capture it — probe by owner),
// Windows uses MessageBox on the calling thread. Linux is unverified: rfd's
// gtk3 backend pumps the default GMainContext from its own thread while we
// block, with the already-created WebKitGTK webview attached to it.
// Nothing has been opened yet, so there is nothing to unwind; process::exit
// is the entire contract (features §3.12: path in the dialog + exit code 1).
fn fail_startup(message: String) -> ! {
    // stderr first: a headless launch (SSH, CI, a crashed window server) has no
    // dialog to read, and exit code 1 alone says nothing about why. Not
    // eprintln!: that panics on EPIPE, which would turn this path into an
    // abort with no dialog when a wrapper's pipe reader has gone away.
    let _ = writeln!(std::io::stderr(), "prompt-hub failed to start: {message}");
    rfd::MessageDialog::new()
        .set_title("prompt-hub failed to start")
        .set_description(message)
        .set_level(rfd::MessageLevel::Error)
        .show();
    std::process::exit(1)
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
                    // Carry the path out alongside the connection so AppState can
                    // hold it for the backup / checkpoint paths.
                    repo_core::db::open_and_migrate(&db_path)
                        .map(|conn| (conn, db_path.clone()))
                        .map_err(|e| {
                            format!(
                                "Failed to open or migrate the database at\n{}\n\n{e}",
                                db_path.display()
                            )
                        })
                });
            let (conn, db_path) = match db_init {
                Ok(pair) => pair,
                // Diverges: dialog + exit(1), never back into the event loop.
                Err(message) => fail_startup(message),
            };
            // Read the wake chord BEFORE managing state, because the shortcut
            // must be registered inside this same setup hook — long before any
            // renderer exists. That ordering is the whole reason this one
            // preference lives in SQLite instead of localStorage (ADR-027).
            // A read failure falls back to the shipped default rather than
            // blocking startup: being summonable matters more than honoring a
            // preference we could not load.
            //
            // Resolve to a chord we can actually register before it is recorded
            // anywhere, so AppState.current_hotkey always describes what is
            // live. A stored value that no longer parses (hand-edited row, a
            // downgrade that dropped a key name) degrades to the default
            // instead of leaving the app with no wake key.
            let stored = repo_core::settings::global_hotkey(&conn)
                .unwrap_or_else(|_| repo_core::settings::DEFAULT_GLOBAL_HOTKEY.to_string());
            let hotkey = if commands::parse_accelerator(&stored).is_ok() {
                stored
            } else {
                eprintln!("stored wake chord {stored:?} is not a valid accelerator; using default");
                repo_core::settings::DEFAULT_GLOBAL_HOTKEY.to_string()
            };

            app.manage(AppState {
                conn: Mutex::new(conn),
                db_path,
                copy_seq: AtomicU64::new(0),
                // Optimistic default; the desktop shortcut setup below flips it
                // false if register() fails.
                hotkey_registered: AtomicBool::new(true),
                current_hotkey: Mutex::new(hotkey.clone()),
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

                // Safe: `hotkey` was resolved above to a value that parses.
                let toggle =
                    commands::parse_accelerator(&hotkey).expect("resolved wake chord must parse");
                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        // A builder-level handler fires for every registered
                        // shortcut, so a rebind (which re-registers without its
                        // own handler) keeps waking the window.
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
                                wake_main_window(app);
                            }
                        })
                        .build(),
                )?;
                // Registering the chord can fail on a user machine — most often
                // it is already claimed by another app (Spotlight remap, an
                // input-method switcher, etc.). Don't propagate: a bare `?` here
                // maps to the invisible "Failed to setup app" panic, so a
                // double-clicked .app just vanishes. Instead record the failure in
                // AppState (hotkey_registered → false) and keep booting; the
                // frontend queries it at mount and warns the user. Wake is still
                // reachable without the chord — via the Dock / relaunch reopen
                // handler below and `show_window` — and the user can rebind to a
                // free chord from settings (ADR-027).
                if let Err(e) = app.global_shortcut().register(toggle) {
                    eprintln!("global shortcut {hotkey} registration failed: {e}");
                    app.state::<AppState>()
                        .hotkey_registered
                        .store(false, Ordering::Relaxed);
                }

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
            commands::hotkey_registered,
            commands::get_global_hotkey,
            commands::set_global_hotkey,
            commands::list_drafts,
            commands::count_pending_drafts,
            commands::get_draft,
            commands::promote_draft,
            commands::update_draft,
            commands::discard_draft,
            commands::restore_draft,
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
            commands::move_phrase,
            commands::create_scene,
            commands::update_scene,
            commands::delete_scene,
            commands::reorder_scenes,
            commands::create_sub_stage,
            commands::update_sub_stage,
            commands::delete_sub_stage,
            commands::reorder_sub_stages,
            commands::restore_asset,
            commands::list_trash,
            commands::purge_trash,
            commands::export_data,
            commands::import_data,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app, event| {
        // macOS applicationShouldHandleReopen — fired by a Dock icon click and
        // by relaunching an already-running .app. This is the escape hatch that
        // makes a user-configurable wake chord safe (ADR-027 sub-decision 3):
        // bind yourself to a chord you cannot press, and this still opens the
        // window so you can rebind. It also fixes a standalone defect — the
        // window is created hidden, so before this handler existed clicking the
        // Dock icon did nothing whatsoever.
        #[cfg(desktop)]
        if let RunEvent::Reopen { .. } = event {
            // Unconditional wake, not a toggle: a reopen is the user asking to
            // see the window, never to dismiss it.
            if let Some(state) = app.try_state::<AppState>() {
                state.copy_seq.fetch_add(1, Ordering::SeqCst);
            }
            wake_main_window(app);
        }

        if let RunEvent::Exit = event {
            #[cfg(desktop)]
            let _ = app.global_shortcut().unregister_all();

            // Fold the WAL back into the main DB file on a clean exit so the
            // on-disk `prompt-hub.db` is self-contained (no lingering `-wal`
            // with uncheckpointed pages). TRUNCATE also shrinks the WAL to 0.
            // Best-effort only: a poisoned lock or busy DB must never block
            // shutdown, so every failure is logged and swallowed.
            if let Some(state) = app.try_state::<AppState>() {
                match state.conn.lock() {
                    Ok(conn) => {
                        // wal_checkpoint(TRUNCATE) returns a result row, so drive
                        // it with execute_batch rather than pragma_update (which is
                        // for `PRAGMA k = v` and would error on the returned rows).
                        if let Err(e) = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE)") {
                            eprintln!("exit checkpoint failed: {e}");
                        }
                    }
                    Err(_) => eprintln!("exit checkpoint skipped: state lock poisoned"),
                }
            }
        }
    });
}
