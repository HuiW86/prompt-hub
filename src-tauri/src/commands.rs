use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
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
    AlignmentPhrase, Composition, Draft, DraftPayload, DraftStatus, DraftSummary, DraftTargetType,
    Macro, Modifier, Phase, Phrase, RecentUsageEntry, RecordUsageInput, Scene, SceneWithChildren,
    SubStage, UsageRecord,
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
    // Absolute path to the on-disk DB file (…/prompt-hub.db). Held so write
    // paths that must snapshot the live database (import wipe-and-restore, exit
    // checkpoint) can locate the file and its sibling `backups/` dir. `None` in
    // the fail-startup fallback, which manages a throwaway in-memory connection
    // with no file to back up.
    pub db_path: Option<PathBuf>,
    // Monotonic copy/show/hide token. Each record_usage / show_window /
    // hide_window bumps it; the 200ms delayed hide checks it on wake and
    // bails if a newer event has happened (rapid second copy, user
    // re-summoned the window, manual hide, etc.). Prevents stale timers
    // from hiding a freshly-shown window.
    pub copy_seq: AtomicU64,
    // Whether the ⌥Space global shortcut registered at setup. Defaults to true;
    // setup flips it false if register() failed (typically the chord is already
    // claimed by another app), so the frontend can query and warn the user that
    // wake won't work. Written once at startup, read once at App mount — never on
    // the wake hot path, so it costs the C1 budget nothing.
    pub hotkey_registered: AtomicBool,
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
pub fn list_modifiers(state: State<'_, AppState>) -> AppResult<Vec<Modifier>> {
    with_conn(&state, repo::list_modifiers)
}

#[tauri::command]
pub fn list_compositions(state: State<'_, AppState>) -> AppResult<Vec<Composition>> {
    with_conn(&state, repo::list_compositions)
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

// True when the ⌥Space global shortcut registered successfully at setup. The
// frontend polls this once at mount and, on false, shows a dismissible banner
// telling the user the wake hotkey is unavailable (usually another app already
// owns ⌥Space). A plain atomic read — no lock, no IO.
#[tauri::command]
pub fn hotkey_registered(state: State<'_, AppState>) -> bool {
    state.hotkey_registered.load(Ordering::Relaxed)
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

// Full-payload read backing the inbox edit flow (PRD §10.3 update_draft "UI
// 编辑保存"). list_drafts deliberately ships only a lossy preview, while
// update_draft is a full-replacement write — so the editor must hydrate the
// stored payload first or it would truncate content / drop phase_id & scene_id.
#[tauri::command]
pub fn get_draft(state: State<'_, AppState>, id: String) -> AppResult<Draft> {
    with_conn(&state, |c| {
        c.get_draft(&id)?
            .ok_or_else(|| RepoError::DraftNotFound(id.clone()))
    })
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

// Reverse a discard (A1-04 / D-5 撤销). Flips a discarded draft back to pending;
// rejects if the dedup slot was re-staged (RepoError::DuplicateDraft) or the row
// is missing / already pending — the renderer surfaces the message.
#[tauri::command]
pub fn restore_draft(state: State<'_, AppState>, id: String) -> AppResult<OkAck> {
    with_write_conn(&state, |c| c.mark_restored(&id))?;
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

// ── Modifier direct editing (plan asset-editing-and-adaptive-layout §0 Q2/Q6,
// decision D-a) ───────────────────────────────────────────────────────────────
// omar-driven create / update / delete / reorder of modifier assets. Tauri-only:
// the MCP server has no repo-write dependency and can only stage drafts. Reorder
// is scoped to a single group_kind quadrant.

#[tauri::command]
pub fn create_modifier(
    state: State<'_, AppState>,
    name: String,
    content: String,
    group_kind: String,
) -> AppResult<Modifier> {
    with_write_conn(&state, |c| {
        repo_write::create_modifier(c, &name, &content, &group_kind)
    })
}

// `group_kind` is the P3-6 quadrant-move remedy (ADR-015 decision iii picks the
// quadrant at promote time; this lets omar fix a wrong pick). Omitted = the
// legacy name/content-only edit.
#[tauri::command]
pub fn update_modifier(
    state: State<'_, AppState>,
    id: String,
    name: String,
    content: String,
    group_kind: Option<String>,
) -> AppResult<OkAck> {
    with_write_conn(&state, |c| {
        repo_write::update_modifier(c, &id, &name, &content, group_kind.as_deref())
    })?;
    Ok(OkAck { ok: true })
}

#[tauri::command]
pub fn delete_modifier(state: State<'_, AppState>, id: String) -> AppResult<OkAck> {
    with_write_conn(&state, |c| repo_write::delete_modifier(c, &id))?;
    Ok(OkAck { ok: true })
}

#[tauri::command]
pub fn reorder_modifiers(
    state: State<'_, AppState>,
    group_kind: String,
    ordered_ids: Vec<String>,
) -> AppResult<OkAck> {
    with_write_conn(&state, |c| {
        repo_write::reorder_modifiers(c, &group_kind, &ordered_ids)
    })?;
    Ok(OkAck { ok: true })
}

// ── AlignmentPhrase direct editing (plan asset-editing-and-adaptive-layout §0
// Q2/Q6, decision D-c) ──────────────────────────────────────────────────────
// omar-driven create / update / delete / reorder of alignment-phrase assets.
// Tauri-only: the MCP server has no repo-write dependency and can only stage
// drafts. Reorder is scoped to a single phase; delete refuses the phase default
// (B2: alignment phrases are the protocol layer, every phase keeps one default).

#[tauri::command]
pub fn create_alignment_phrase(
    state: State<'_, AppState>,
    phase_id: String,
    name: String,
    content: String,
) -> AppResult<AlignmentPhrase> {
    with_write_conn(&state, |c| {
        repo_write::create_alignment_phrase(c, &phase_id, &name, &content)
    })
}

#[tauri::command]
pub fn update_alignment_phrase(
    state: State<'_, AppState>,
    id: String,
    name: String,
    content: String,
) -> AppResult<OkAck> {
    with_write_conn(&state, |c| {
        repo_write::update_alignment_phrase(c, &id, &name, &content)
    })?;
    Ok(OkAck { ok: true })
}

#[tauri::command]
pub fn delete_alignment_phrase(state: State<'_, AppState>, id: String) -> AppResult<OkAck> {
    with_write_conn(&state, |c| repo_write::delete_alignment_phrase(c, &id))?;
    Ok(OkAck { ok: true })
}

#[tauri::command]
pub fn reorder_alignment_phrases(
    state: State<'_, AppState>,
    phase_id: String,
    ordered_ids: Vec<String>,
) -> AppResult<OkAck> {
    with_write_conn(&state, |c| {
        repo_write::reorder_alignment_phrases(c, &phase_id, &ordered_ids)
    })?;
    Ok(OkAck { ok: true })
}

// P3-6: swap the phase's protocol default (delete refuses the default and create
// is always non-default, so this is the only way the default can ever change).
#[tauri::command]
pub fn set_default_alignment_phrase(
    state: State<'_, AppState>,
    phase_id: String,
    id: String,
) -> AppResult<OkAck> {
    with_write_conn(&state, |c| {
        repo_write::set_default_alignment_phrase(c, &phase_id, &id)
    })?;
    Ok(OkAck { ok: true })
}

// ── Composition direct editing (plan asset-editing-and-adaptive-layout §0 Q2/Q6,
// decision A + per-phase) ───────────────────────────────────────────────────
// omar-driven create / update / delete / reorder of composition assets. Tauri-only:
// the MCP server has no repo-write dependency and can only stage drafts. A
// composition's body is a modifier_ids array (decision D-b); reorder is scoped to a
// single phase since order_index restarts per phase.

#[tauri::command]
pub fn create_composition(
    state: State<'_, AppState>,
    phase_id: String,
    name: String,
    modifier_ids: Vec<String>,
    scene_id: Option<String>,
) -> AppResult<Composition> {
    with_write_conn(&state, |c| {
        repo_write::create_composition(c, &phase_id, &name, &modifier_ids, scene_id.as_deref())
    })
}

#[tauri::command]
pub fn update_composition(
    state: State<'_, AppState>,
    id: String,
    name: String,
    modifier_ids: Vec<String>,
) -> AppResult<OkAck> {
    with_write_conn(&state, |c| {
        repo_write::update_composition(c, &id, &name, &modifier_ids)
    })?;
    Ok(OkAck { ok: true })
}

#[tauri::command]
pub fn delete_composition(state: State<'_, AppState>, id: String) -> AppResult<OkAck> {
    with_write_conn(&state, |c| repo_write::delete_composition(c, &id))?;
    Ok(OkAck { ok: true })
}

#[tauri::command]
pub fn reorder_compositions(
    state: State<'_, AppState>,
    phase_id: String,
    ordered_ids: Vec<String>,
) -> AppResult<OkAck> {
    with_write_conn(&state, |c| {
        repo_write::reorder_compositions(c, &phase_id, &ordered_ids)
    })?;
    Ok(OkAck { ok: true })
}

// ── Scene phrase direct editing (plan scene-phrase-editing) ───────────────────
// omar-driven create / update / delete / reorder of scene-phrase assets. Tauri-only:
// the MCP server has no repo-write dependency and can only stage drafts. A phrase is
// bound to a scene and an OPTIONAL sub-stage; order_index restarts per
// (scene_id, sub_stage_id) partition, so reorder is scoped to one such group.

#[tauri::command]
pub fn create_phrase(
    state: State<'_, AppState>,
    scene_id: String,
    name: String,
    content: String,
    sub_stage_id: Option<String>,
) -> AppResult<Phrase> {
    with_write_conn(&state, |c| {
        repo_write::create_phrase(c, &scene_id, &name, &content, sub_stage_id.as_deref())
    })
}

#[tauri::command]
pub fn update_phrase(
    state: State<'_, AppState>,
    id: String,
    name: String,
    content: String,
    sub_stage_id: Option<String>,
) -> AppResult<OkAck> {
    with_write_conn(&state, |c| {
        repo_write::update_phrase(c, &id, &name, &content, sub_stage_id.as_deref())
    })?;
    Ok(OkAck { ok: true })
}

#[tauri::command]
pub fn delete_phrase(state: State<'_, AppState>, id: String) -> AppResult<OkAck> {
    with_write_conn(&state, |c| repo_write::delete_phrase(c, &id))?;
    Ok(OkAck { ok: true })
}

#[tauri::command]
pub fn reorder_phrases(
    state: State<'_, AppState>,
    scene_id: String,
    sub_stage_id: Option<String>,
    ordered_ids: Vec<String>,
) -> AppResult<OkAck> {
    with_write_conn(&state, |c| {
        repo_write::reorder_phrases(c, &scene_id, sub_stage_id.as_deref(), &ordered_ids)
    })?;
    Ok(OkAck { ok: true })
}

// ── Scene / SubStage structural editing (plan scene-substage-editing) ─────────
// omar-driven create / update / delete / reorder of Scene containers and their
// SubStage groups. Tauri-only (no MCP write face). Scenes order globally; sub-
// stages order per-scene. delete_scene refuses a non-empty scene (D4); delete of
// a sub-stage unbinds its child phrases to NULL rather than cascade-deleting them.

#[tauri::command]
pub fn create_scene(
    state: State<'_, AppState>,
    name: String,
    icon: Option<String>,
    role_presets: Vec<String>,
    color: Option<String>,
) -> AppResult<Scene> {
    with_write_conn(&state, |c| {
        repo_write::create_scene(c, &name, icon.as_deref(), &role_presets, color.as_deref())
    })
}

#[tauri::command]
pub fn update_scene(
    state: State<'_, AppState>,
    id: String,
    name: String,
    icon: Option<String>,
    role_presets: Vec<String>,
    color: Option<String>,
) -> AppResult<OkAck> {
    with_write_conn(&state, |c| {
        repo_write::update_scene(
            c,
            &id,
            &name,
            icon.as_deref(),
            &role_presets,
            color.as_deref(),
        )
    })?;
    Ok(OkAck { ok: true })
}

#[tauri::command]
pub fn delete_scene(state: State<'_, AppState>, id: String) -> AppResult<OkAck> {
    with_write_conn(&state, |c| repo_write::delete_scene(c, &id))?;
    Ok(OkAck { ok: true })
}

#[tauri::command]
pub fn reorder_scenes(state: State<'_, AppState>, ordered_ids: Vec<String>) -> AppResult<OkAck> {
    with_write_conn(&state, |c| repo_write::reorder_scenes(c, &ordered_ids))?;
    Ok(OkAck { ok: true })
}

#[tauri::command]
pub fn create_sub_stage(
    state: State<'_, AppState>,
    scene_id: String,
    name: String,
) -> AppResult<SubStage> {
    with_write_conn(&state, |c| {
        repo_write::create_sub_stage(c, &scene_id, &name)
    })
}

#[tauri::command]
pub fn update_sub_stage(state: State<'_, AppState>, id: String, name: String) -> AppResult<OkAck> {
    with_write_conn(&state, |c| repo_write::update_sub_stage(c, &id, &name))?;
    Ok(OkAck { ok: true })
}

#[tauri::command]
pub fn delete_sub_stage(state: State<'_, AppState>, id: String) -> AppResult<OkAck> {
    with_write_conn(&state, |c| repo_write::delete_sub_stage(c, &id))?;
    Ok(OkAck { ok: true })
}

#[tauri::command]
pub fn reorder_sub_stages(
    state: State<'_, AppState>,
    scene_id: String,
    ordered_ids: Vec<String>,
) -> AppResult<OkAck> {
    with_write_conn(&state, |c| {
        repo_write::reorder_sub_stages(c, &scene_id, &ordered_ids)
    })?;
    Ok(OkAck { ok: true })
}

// ── Data import / export (PRD §6.9 / §7.5) ────────────────────────────────────
// Full-fidelity local JSON backup + restore. The frontend uses the dialog plugin
// to pick a path; the file read/write itself happens here in Rust (std::fs) so we
// need no fs-plugin scope grant. export is a read; import is a wipe-and-restore
// write (strategy D1=A) and pays the schema-drift guard like every write path.
// Both stay entirely on-disk — no network (A2).

#[tauri::command]
pub fn export_data(state: State<'_, AppState>, path: String) -> AppResult<()> {
    let json = with_conn(&state, repo_core::export_json)?;
    std::fs::write(&path, json).map_err(repo_core::RepoError::from)?;
    Ok(())
}

#[tauri::command]
pub fn import_data(
    state: State<'_, AppState>,
    path: String,
) -> AppResult<repo_write::ImportSummary> {
    let json = std::fs::read_to_string(&path).map_err(repo_core::RepoError::from)?;
    let guard = state.conn.lock().map_err(|_| AppError::LockPoisoned)?;
    import_with_backup(&guard, state.db_path.as_deref(), &json)
}

// Snapshot-then-restore under a caller-held lock. Split out from the command so
// it's unit-testable without a live `State`. Fail-safe: the pre-import snapshot
// runs before the wipe-and-restore (import_json truncates every asset table,
// strategy D1=A), and any snapshot failure aborts the import — the caller keeps
// its intact DB rather than losing data to a half-restore. When `db_path` is
// None (fail-startup in-memory fallback) there's no file to back up, so the
// import proceeds without a snapshot.
fn import_with_backup(
    conn: &Connection,
    db_path: Option<&std::path::Path>,
    json: &str,
) -> AppResult<repo_write::ImportSummary> {
    if let Some(db_path) = db_path {
        let backups_dir = repo_core::backups_dir_for(db_path);
        // RepoError -> AppError via `?`; surfaces to the renderer as "backup
        // failed" so the user knows the import did NOT run.
        repo_core::snapshot(conn, &backups_dir, "pre-import")?;
    }
    Ok(guard_schema_then(conn, |c| {
        repo_write::import_json(c, json)
    })?)
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

    fn pre_import_backup_count(db_path: &std::path::Path) -> usize {
        let dir = repo_core::backups_dir_for(db_path);
        std::fs::read_dir(&dir)
            .map(|rd| {
                rd.filter_map(|e| e.ok())
                    .map(|e| e.path())
                    .filter(|p| {
                        p.extension().is_some_and(|x| x == "db")
                            && p.file_name()
                                .and_then(|n| n.to_str())
                                .is_some_and(|n| n.starts_with("pre-import-"))
                    })
                    .count()
            })
            .unwrap_or(0)
    }

    #[test]
    fn import_writes_a_pre_import_backup_then_restores() {
        let (dir, conn) = migrated_conn();
        let db_path = dir.path().join("prompt-hub.db");
        // A minimal valid export bundle round-trips through import_json.
        let json = repo_core::export_json(&conn).expect("export current db");

        assert_eq!(pre_import_backup_count(&db_path), 0, "clean start");
        let summary = import_with_backup(&conn, Some(db_path.as_path()), &json)
            .expect("import with backup succeeds");
        // The import ran (summary is produced) AND a snapshot was written first.
        let _ = summary;
        assert_eq!(
            pre_import_backup_count(&db_path),
            1,
            "import must leave exactly one pre-import snapshot"
        );
    }

    #[test]
    fn import_aborts_when_backup_fails() {
        let (_dir, conn) = migrated_conn();
        let json = repo_core::export_json(&conn).expect("export");

        // Point db_path at a *fresh* dir whose backups/ slot we pre-occupy with a
        // regular file, so snapshot()'s create_dir_all fails — the import must NOT
        // proceed. (Using the migrated dir would find backups/ already a real dir.)
        let blocked = tempfile::tempdir().expect("tempdir");
        let db_path = blocked.path().join("prompt-hub.db");
        let backups = repo_core::backups_dir_for(&db_path);
        std::fs::write(&backups, b"blocker").expect("occupy backups path with a file");

        let err = import_with_backup(&conn, Some(db_path.as_path()), &json)
            .expect_err("backup failure must abort import");
        // Surfaces as a repo/io error, not a silent success.
        assert!(
            matches!(err, AppError::Repo(_)),
            "expected a Repo error from the failed snapshot, got {err:?}"
        );
    }

    #[test]
    fn import_without_db_path_skips_backup_and_still_imports() {
        let (_dir, conn) = migrated_conn();
        let json = repo_core::export_json(&conn).expect("export");
        // db_path=None mirrors the fail-startup in-memory fallback: no snapshot,
        // import still runs.
        import_with_backup(&conn, None, &json).expect("import proceeds without a backup target");
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
