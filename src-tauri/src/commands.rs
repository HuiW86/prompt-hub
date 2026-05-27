use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use rusqlite::Connection;
use tauri::{AppHandle, Manager, State, WebviewWindow};

// Window stays visible briefly after a copy so the user sees the flash
// confirmation before it hides. Matches the 200ms allowance in
// docs/plans/prompt-hub-mvp.md 第一阶段交付标准.
const COPY_HIDE_DELAY_MS: u64 = 200;

// Defense against a renderer sending an unbounded LIMIT (or LIMIT -1, which
// SQLite treats as "all rows"). Recent list never needs more than a handful
// — the UI caps at 5 today and won't realistically grow past 50.
const RECENT_USAGE_LIMIT_MAX: i64 = 100;

use crate::error::{AppError, AppResult};
use crate::models::{
    AlignmentPhrase, Macro, Phase, RecentUsageEntry, RecordUsageInput, SceneWithChildren,
    UsageRecord,
};
use crate::repo;

pub struct AppState {
    pub conn: Mutex<Connection>,
    // Monotonic copy/show/hide token. Each record_usage / show_window /
    // hide_window bumps it; the 200ms delayed hide checks it on wake and
    // bails if a newer event has happened (rapid second copy, user
    // re-summoned the window, manual hide, etc.). Prevents stale timers
    // from hiding a freshly-shown window.
    pub copy_seq: AtomicU64,
}

fn with_conn<F, T>(state: &State<'_, AppState>, f: F) -> AppResult<T>
where
    F: FnOnce(&Connection) -> AppResult<T>,
{
    let guard = state.conn.lock().map_err(|_| AppError::LockPoisoned)?;
    f(&guard)
}

#[tauri::command]
pub fn list_phases(state: State<'_, AppState>) -> AppResult<Vec<Phase>> {
    with_conn(&state, repo::list_phases)
}

#[tauri::command]
pub fn list_alignment_phrases(state: State<'_, AppState>) -> AppResult<Vec<AlignmentPhrase>> {
    with_conn(&state, repo::list_alignment_phrases)
}

#[tauri::command]
pub fn list_macros(state: State<'_, AppState>) -> AppResult<Vec<Macro>> {
    with_conn(&state, repo::list_macros)
}

#[tauri::command]
pub fn list_scenes_with_children(state: State<'_, AppState>) -> AppResult<Vec<SceneWithChildren>> {
    with_conn(&state, repo::list_scenes_with_children)
}

#[tauri::command]
pub fn list_recent_usage(
    state: State<'_, AppState>,
    limit: i64,
) -> AppResult<Vec<RecentUsageEntry>> {
    // Clamp at the command boundary so neither a bogus payload nor SQLite's
    // "LIMIT -1 = all rows" can stall the single DB mutex as history grows.
    let clamped = limit.clamp(1, RECENT_USAGE_LIMIT_MAX);
    with_conn(&state, |c| repo::list_recent_usage(c, clamped))
}

#[tauri::command]
pub fn count_today_usage(state: State<'_, AppState>) -> AppResult<i64> {
    with_conn(&state, repo::count_today_usage)
}

#[tauri::command]
pub fn record_usage(
    state: State<'_, AppState>,
    app: AppHandle,
    input: RecordUsageInput,
) -> AppResult<UsageRecord> {
    let record = with_conn(&state, |c| repo::record_usage(c, input))?;
    // 复制即隐藏 (03-product-spec §4.4). The delay gives the React side a
    // window to flash the card and show a toast; failure to hide is a UX
    // glitch, not a reason to roll back the usage record.
    let my_seq = state.copy_seq.fetch_add(1, Ordering::SeqCst) + 1;
    if let Some(window) = app.get_webview_window("main") {
        let app_clone = app.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(Duration::from_millis(COPY_HIDE_DELAY_MS)).await;
            // Only hide if no newer copy/show/hide event has happened during
            // the delay. Without this guard, a rapid second copy or a manual
            // re-summon between t=0 and t=200ms would be silently hidden by
            // a stale timer.
            let state = app_clone.state::<AppState>();
            if state.copy_seq.load(Ordering::SeqCst) == my_seq {
                let _ = window.hide();
            }
        });
    }
    Ok(record)
}

#[tauri::command]
pub fn hide_window(state: State<'_, AppState>, window: WebviewWindow) -> AppResult<()> {
    // Invalidate any pending 200ms hide timer so a subsequent show isn't
    // immediately hidden by a stale wake from an earlier copy.
    state.copy_seq.fetch_add(1, Ordering::SeqCst);
    window.hide()?;
    Ok(())
}

#[tauri::command]
pub fn show_window(state: State<'_, AppState>, window: WebviewWindow) -> AppResult<()> {
    state.copy_seq.fetch_add(1, Ordering::SeqCst);
    window.show()?;
    // Skip set_focus on macOS: tao's implementation calls
    // activateIgnoringOtherApps: which fights the NSPanel non-activating
    // model set up in macos::apply_nonactivating_panel at setup. The IPC
    // command is invoked from the frontend (which runs on the main
    // thread), so order_front is safe to call directly.
    #[cfg(not(target_os = "macos"))]
    window.set_focus()?;
    #[cfg(target_os = "macos")]
    crate::macos::order_front(&window);
    Ok(())
}
