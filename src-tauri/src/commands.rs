use std::sync::Mutex;
use std::time::Duration;

use rusqlite::Connection;
use tauri::{AppHandle, Manager, State, WebviewWindow};

// Window stays visible briefly after a copy so the user sees the flash
// confirmation before it hides. Matches the 200ms allowance in
// docs/plans/prompt-hub-mvp.md 第一阶段交付标准.
const COPY_HIDE_DELAY_MS: u64 = 200;

use crate::error::{AppError, AppResult};
use crate::models::{
    AlignmentPhrase, Macro, Phase, RecentUsageEntry, RecordUsageInput, SceneWithChildren,
    UsageRecord,
};
use crate::repo;

pub struct AppState {
    pub conn: Mutex<Connection>,
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
    with_conn(&state, |c| repo::list_recent_usage(c, limit))
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
    if let Some(window) = app.get_webview_window("main") {
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(COPY_HIDE_DELAY_MS));
            let _ = window.hide();
        });
    }
    Ok(record)
}

#[tauri::command]
pub fn hide_window(window: WebviewWindow) -> AppResult<()> {
    window.hide()?;
    Ok(())
}

#[tauri::command]
pub fn show_window(window: WebviewWindow) -> AppResult<()> {
    window.show()?;
    window.set_focus()?;
    Ok(())
}
