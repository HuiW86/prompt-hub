use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use rusqlite::Connection;
use serde::Serialize;
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
use repo_core::models::{
    AlignmentPhrase, DraftPayload, DraftStatus, DraftSummary, DraftTargetType, Macro, Phase,
    RecentUsageEntry, RecordUsageInput, SceneWithChildren, UsageRecord,
};
use repo_core::{repo, DraftRepo, RepoError};
use repo_write::promote::PromoteOptions;

// Draft-inbox list bounds. The Scene 草稿 tab shows pending drafts created by the
// MCP pipeline; the count is bounded in practice, but clamp at the boundary so a
// bogus renderer payload (or LIMIT -1 = all rows) can't stall the single DB mutex.
const DRAFT_LIST_DEFAULT_LIMIT: i64 = 50;
const DRAFT_LIST_LIMIT_MAX: i64 = 200;

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
    F: FnOnce(&Connection) -> repo_core::RepoResult<T>,
{
    let guard = state.conn.lock().map_err(|_| AppError::LockPoisoned)?;
    Ok(f(&guard)?)
}

// Like `with_conn`, but re-checks the on-disk schema version before running a
// WRITE. The AppState connection is opened & migrated once at startup; if a newer
// app build (or a future hot-swap) migrated the file underneath this long-lived
// handle, writing against the stale in-memory schema picture could corrupt rows.
// Reads tolerate a drifted schema, so only the draft write/promote path pays this
// one pragma per call. Mirrors the startup guard in `db::open_write_checked`.
fn with_write_conn<F, T>(state: &State<'_, AppState>, f: F) -> AppResult<T>
where
    F: FnOnce(&Connection) -> repo_core::RepoResult<T>,
{
    let guard = state.conn.lock().map_err(|_| AppError::LockPoisoned)?;
    Ok(guard_schema_then(&guard, f)?)
}

fn guard_schema_then<F, T>(conn: &Connection, f: F) -> repo_core::RepoResult<T>
where
    F: FnOnce(&Connection) -> repo_core::RepoResult<T>,
{
    let found: u32 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    let expected = repo_core::db::latest_version();
    if found != expected {
        return Err(RepoError::SchemaVersionMismatch { found, expected });
    }
    f(conn)
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
    {
        crate::macos::wake(&window);
    }
    Ok(())
}

// ── Draft inbox (PRD §10.3) — Tauri-only, never exposed via MCP ──────────────
// promote / edit / discard are omar-driven actions; the MCP server has no path
// to them (and no `repo-write` dependency). list / count are reads.

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PromoteResult {
    inserted_asset_id: String,
    inserted_asset_type: DraftTargetType,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAck {
    ok: bool,
    updated_at: String,
}

#[derive(Serialize)]
pub struct OkAck {
    ok: bool,
}

#[tauri::command]
pub fn list_drafts(
    state: State<'_, AppState>,
    status: Option<DraftStatus>,
    target_type: Option<DraftTargetType>,
    limit: Option<i64>,
) -> AppResult<Vec<DraftSummary>> {
    let limit = limit
        .unwrap_or(DRAFT_LIST_DEFAULT_LIMIT)
        .clamp(1, DRAFT_LIST_LIMIT_MAX);
    with_conn(&state, |c| c.list_drafts(status, target_type, limit))
}

#[tauri::command]
pub fn count_pending_drafts(state: State<'_, AppState>) -> AppResult<u32> {
    with_conn(&state, repo_core::count_pending_drafts)
}

#[tauri::command]
pub fn promote_draft(
    state: State<'_, AppState>,
    id: String,
    override_payload: Option<DraftPayload>,
    group_kind: Option<String>,
) -> AppResult<PromoteResult> {
    let outcome = with_write_conn(&state, |c| {
        repo_write::promote::promote_draft(
            c,
            &id,
            PromoteOptions {
                override_payload,
                group_kind,
            },
        )
    })?;
    Ok(PromoteResult {
        inserted_asset_id: outcome.asset_id,
        inserted_asset_type: outcome.target_type,
    })
}

#[tauri::command]
pub fn update_draft(
    state: State<'_, AppState>,
    id: String,
    payload: DraftPayload,
) -> AppResult<UpdateAck> {
    let updated_at = with_write_conn(&state, |c| {
        c.update_draft(&id, &payload)?;
        // Re-read inside the same lock so the ack carries the row's authoritative
        // updated_at rather than a clock value the renderer can't trust.
        let draft = c
            .get_draft(&id)?
            .ok_or_else(|| RepoError::DraftNotFound(id.clone()))?;
        Ok(draft.updated_at.to_rfc3339())
    })?;
    Ok(UpdateAck {
        ok: true,
        updated_at,
    })
}

#[tauri::command]
pub fn discard_draft(state: State<'_, AppState>, id: String) -> AppResult<OkAck> {
    with_write_conn(&state, |c| c.mark_discarded(&id))?;
    Ok(OkAck { ok: true })
}

// ── Macro direct editing (plan asset-editing-and-adaptive-layout §0 Q2/Q6) ────
// omar-driven create / update / delete / reorder of macro assets. Tauri-only:
// the MCP server has no repo-write dependency and can only stage drafts.

#[tauri::command]
pub fn create_macro(
    state: State<'_, AppState>,
    name: String,
    content: String,
    scene_id: Option<String>,
) -> AppResult<Macro> {
    with_write_conn(&state, |c| {
        repo_write::create_macro(c, &name, &content, scene_id.as_deref())
    })
}

#[tauri::command]
pub fn update_macro(
    state: State<'_, AppState>,
    id: String,
    name: String,
    content: String,
) -> AppResult<OkAck> {
    with_write_conn(&state, |c| {
        repo_write::update_macro(c, &id, &name, &content)
    })?;
    Ok(OkAck { ok: true })
}

#[tauri::command]
pub fn delete_macro(state: State<'_, AppState>, id: String) -> AppResult<OkAck> {
    with_write_conn(&state, |c| repo_write::delete_macro(c, &id))?;
    Ok(OkAck { ok: true })
}

#[tauri::command]
pub fn reorder_macros(state: State<'_, AppState>, ordered_ids: Vec<String>) -> AppResult<OkAck> {
    with_write_conn(&state, |c| repo_write::reorder_macros(c, &ordered_ids))?;
    Ok(OkAck { ok: true })
}

#[cfg(test)]
mod tests {
    use super::*;
    use repo_core::db;

    fn migrated_conn() -> (tempfile::TempDir, Connection) {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("prompt-hub.db");
        let conn = db::open_and_migrate(&path).expect("migrate");
        (dir, conn)
    }

    #[test]
    fn schema_guard_runs_closure_on_current_schema() {
        let (_dir, conn) = migrated_conn();
        let out = guard_schema_then(&conn, |_| Ok(42)).expect("guard passes");
        assert_eq!(out, 42);
    }

    #[test]
    fn schema_guard_rejects_drifted_schema_before_running_closure() {
        let (_dir, conn) = migrated_conn();
        // Simulate the DB being migrated to a newer version under our long-lived
        // connection. Use latest+1 so the test holds regardless of current latest.
        let stale = db::latest_version() + 1;
        conn.pragma_update(None, "user_version", stale)
            .expect("set drifted version");

        let mut ran = false;
        let err = guard_schema_then(&conn, |_| {
            ran = true;
            Ok::<(), RepoError>(())
        })
        .expect_err("drifted schema must be rejected");

        assert!(!ran, "closure must not run when the schema has drifted");
        assert!(
            matches!(err, RepoError::SchemaVersionMismatch { found, .. } if found == stale),
            "got {err:?}"
        );
    }
}
