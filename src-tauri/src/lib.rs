use std::io::Write;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime};

use tauri::{Manager, PhysicalPosition, PhysicalSize, RunEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_log::{Target, TargetKind};

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
    let _ = app.run_on_main_thread(move || wake_on_main_thread(&window));
}

// The wake itself, already on the main thread. Split out from
// `wake_main_window` so the bench harness measures THIS — the same sequence the
// chord runs, emit included — instead of its own copy of it. A bench that
// re-implements the path it is timing stops being a measurement of the path
// (the emit added by ADR-029 sat outside the old bench's stopwatch entirely).
#[cfg(desktop)]
pub(crate) fn wake_on_main_thread(window: &tauri::WebviewWindow) {
    fit_to_active_monitor(window);
    let _ = window.show();
    #[cfg(not(target_os = "macos"))]
    let _ = window.set_focus();
    #[cfg(target_os = "macos")]
    macos::wake(window);
    // AFTER the window is up, never before: the C1 budget is measured to the
    // moment the overlay is on screen, and nothing about this stamp is worth a
    // millisecond of it. Formatting one timestamp is all that happens here — no
    // database, no lock, no allocation worth naming.
    //
    // This is the session boundary the drift ledger groups by (ADR-029 子决策 4
    // / HANDOFF 21.1): every usage record written until the next wake carries
    // this value, which is what makes "the cues that followed this opening
    // phrase" a bounded question instead of a search through all history.
    emit_wake(window);
}

// One `wake` event carrying the moment this summon happened. The frontend
// stamps every usage record with it; a record written before any wake (a dev
// window, a test) falls back to the renderer's own start time, and one written
// by a build older than this carries NULL, which the ledger skips.
#[cfg(desktop)]
fn emit_wake(window: &tauri::WebviewWindow) {
    use tauri::Emitter;
    let started_at = chrono::Utc::now().to_rfc3339();
    if let Err(e) = window.emit(
        "wake",
        serde_json::json!({ "sessionStartedAt": started_at }),
    ) {
        // A dropped stamp costs one session's attribution, not the wake itself.
        log::warn!("failed to emit wake event: {e}");
    }
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
    // The log file outlives the dialog the user is about to dismiss, and it is
    // the only artifact they can send us afterwards. Safe here: plugins are
    // initialized before setup runs, so the sink already exists.
    log::error!("startup aborted: {message}");
    // stderr too: a headless launch (SSH, CI, a crashed window server) has no
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

// How often the background thread wakes to ask whether a daily backup is owed.
// The *schedule* is a full day (repo_core::DAILY_BACKUP_INTERVAL); polling more
// often than that is what makes the schedule survive a machine that was asleep,
// or an app left running for a week.
const DAILY_BACKUP_POLL: Duration = Duration::from_secs(60 * 60);

// Take a `daily-*.db` snapshot if the newest one is at least a day old.
//
// Best-effort by construction: every failure is logged and swallowed. A backup
// that could not be taken is a smaller problem than a startup that refuses to
// finish or a background thread that dies silently.
//
// The connection mutex is held for exactly one `VACUUM INTO`. That is the same
// lock every IPC command takes, so this must never be called from anything on
// the wake path — it is called from setup (once) and from its own thread.
fn run_daily_backup_if_due(app: &tauri::AppHandle) {
    let Some(state) = app.try_state::<AppState>() else {
        // Only reachable if the thread outlives managed state during shutdown.
        return;
    };
    let backups_dir = repo_core::backups_dir_for(&state.db_path);
    if !repo_core::daily_backup_due(&backups_dir, SystemTime::now()) {
        return;
    }
    // let-else rather than `match`: the guard has to be a binding that drops
    // before `state` does, and a `match` scrutinee's temporary Result outlives
    // `state` at the closing brace.
    let Ok(conn) = state.conn.lock() else {
        log::warn!("daily backup skipped: state lock poisoned");
        return;
    };
    // snapshot() logs the written / unchanged outcome itself.
    if let Err(e) = repo_core::snapshot(&conn, &backups_dir, repo_core::PREFIX_DAILY) {
        log::warn!("daily backup failed: {e}");
    }
}

// Keep the daily schedule running for as long as the app does.
//
// A dedicated std thread rather than an async task, and the reason is the shape
// of the schedule, not the blocking. A short blocking command on a tokio worker
// is fine — it is what Tauri recommends for heavy commands and what
// `import_data` now does. This one differs by being periodic rather than
// request-driven: it has to outlive every request and spend an hour at a time
// asleep, which is exactly what a shared runtime worker must never do.
fn spawn_daily_backup_thread(app: tauri::AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(DAILY_BACKUP_POLL);
        run_daily_backup_if_due(&app);
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // On-disk logging (HANDOFF 21.3). `targets` REPLACES the plugin defaults
    // (Stdout + LogDir) rather than appending, which is what keeps a release
    // build from writing to a stdout nobody is reading.
    //
    // Nothing here is wired to the webview: no `TargetKind::Webview`, and the
    // capability file grants no `log:` permission, so the renderer can neither
    // write to this file nor read it. What lands on disk is paths, versions,
    // counts and error text — never phrase or asset content, which constitution
    // A2 keeps out of anywhere the user did not put it themselves.
    let mut log_targets = vec![Target::new(TargetKind::LogDir {
        file_name: Some("prompt-hub".into()),
    })];
    if cfg!(debug_assertions) {
        log_targets.push(Target::new(TargetKind::Stdout));
    }
    let log_plugin = tauri_plugin_log::Builder::new()
        .targets(log_targets)
        // One megabyte, one rotated file kept. The point of this log is the last
        // launch or two, not an archive.
        .max_file_size(1024 * 1024)
        .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepOne)
        .level(if cfg!(debug_assertions) {
            log::LevelFilter::Debug
        } else {
            log::LevelFilter::Info
        })
        .build();

    let app = tauri::Builder::default()
        .plugin(log_plugin)
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
                            // Name both paths. The startup self-check refuses to
                            // migrate a damaged file rather than repairing it, so
                            // the only move left is a manual restore — and a
                            // dialog that says "it's broken" without saying where
                            // the snapshots are leaves the user with nothing to
                            // do. No automatic rollback: picking which snapshot
                            // to lose work back to is the user's call, not ours.
                            format!(
                                "Failed to open or migrate the database at\n{}\n\n{e}\n\n\
                                 Automatic snapshots of this database are kept in\n{}\n\n\
                                 To recover: quit prompt-hub, and keep a copy of the damaged \
                                 database file somewhere safe before you touch it. Then replace \
                                 it with the most recent snapshot from that folder, and delete \
                                 prompt-hub.db-wal and prompt-hub.db-shm from beside it. \
                                 Start prompt-hub again.",
                                db_path.display(),
                                repo_core::backups_dir_for(&db_path).display()
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
                log::warn!(
                    "stored wake chord {stored:?} is not a valid accelerator; using default"
                );
                repo_core::settings::DEFAULT_GLOBAL_HOTKEY.to_string()
            };

            // One line per launch, recorded while the connection is still in
            // hand. This is the line that answers "which build, which file,
            // which schema" when a user reports something months from now —
            // quick_check is in it because reaching this point proves it passed.
            let user_version: u32 = conn
                .pragma_query_value(None, "user_version", |row| row.get(0))
                .unwrap_or(0);
            log::info!(
                "prompt-hub {} started: db={} user_version={} quick_check=ok",
                app.package_info().version,
                db_path.display(),
                user_version
            );

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
                    log::error!("global shortcut {hotkey} registration failed: {e}");
                    app.state::<AppState>()
                        .hotkey_registered
                        .store(false, Ordering::Relaxed);
                }

                #[cfg(feature = "bench")]
                bench::spawn_wake_cycle(app.handle().clone());
            }

            // Daily snapshots (HANDOFF 21.3). Placed last in setup so nothing
            // above — least of all the wake chord — waits on a VACUUM. The first
            // check is synchronous because a machine that is only ever awake for
            // minutes at a time would otherwise never reach the first poll; from
            // then on the thread carries the schedule.
            run_daily_backup_if_due(app.handle());
            spawn_daily_backup_thread(app.handle().clone());

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
            commands::list_alignment_axis_values,
            commands::create_alignment_axis_value,
            commands::update_alignment_axis_value,
            commands::delete_alignment_axis_value,
            commands::reorder_alignment_axis_values,
            commands::summarize_drift_ledger,
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
                            log::warn!("exit checkpoint failed: {e}");
                        }
                    }
                    Err(_) => log::warn!("exit checkpoint skipped: state lock poisoned"),
                }
            }
        }
    });
}
