//! The MCP server handler. `Hub` holds the single read+write SQLite connection
//! behind a `std::sync::Mutex`: stdio MCP is a single serial client, rusqlite
//! calls are short synchronous bursts, and the guard is never held across an
//! `.await` (which would be `!Send`). No connection pool is needed for stdio.
//!
//! The 14 tools (plan §5) are thin: they marshal MCP JSON into `repo-core`
//! domain types, run one short DB call under the lock, and shape the result.
//! Write tools reach only `DraftRepo` (the drafts inbox); read tools reach only
//! `ReadOnlyAssetRepo`. The real asset tables are unreachable here because this
//! crate doesn't depend on `repo-write` (plan §3.3).

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use rmcp::handler::server::router::tool::ToolRouter;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::{
    CallToolResult, Content, Implementation, ProtocolVersion, ServerCapabilities, ServerInfo,
};
use rmcp::schemars::JsonSchema;
use rmcp::{tool, tool_handler, tool_router, ErrorData as McpError, ServerHandler};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use repo_core::models::{DraftStatus, DraftTargetType};
use repo_core::{DraftRepo, ReadOnlyAssetRepo, RepoError};

use crate::errors::{invalid_input, json_ok, repo_error};
use crate::tools::{split_markdown_sections, PayloadArg, ProvenanceArg};

// import_json hardening (plan §5.2). The DB-size guard and 5MB request cap are
// deferred to M-X.4; the batch/payload caps and the hourly quota ship now.
const MAX_IMPORT_BATCH: usize = 100;
// Per-payload 64KB cap lives in repo-core (PRD §10.1.1) so single writes
// (create/update_draft) and this batch pre-check can't drift apart.
use repo_core::MAX_PAYLOAD_BYTES;
const IMPORT_QUOTA_PER_HOUR: usize = 5;
const IMPORT_QUOTA_WINDOW: Duration = Duration::from_secs(3600);

// Cap list_drafts so a runaway inbox can't blow the model's token budget.
const DEFAULT_DRAFT_LIMIT: i64 = 50;
const MAX_DRAFT_LIMIT: i64 = 100;

// Read-tool previews: enough to spot a near-duplicate by eye, not the whole body.
const PREVIEW_CHARS: usize = 120;

#[derive(serde::Deserialize, JsonSchema)]
#[schemars(crate = "rmcp::schemars")]
pub struct EchoArgs {
    /// Text to echo back unchanged.
    pub msg: String,
}

#[derive(Deserialize, JsonSchema)]
#[schemars(crate = "rmcp::schemars")]
pub struct CreateDraftArgs {
    /// The draft body, tagged by `target_type`.
    pub payload: PayloadArg,
    /// Optional origin metadata for the audit trail.
    #[serde(default)]
    pub provenance: Option<ProvenanceArg>,
}

#[derive(Deserialize, JsonSchema)]
#[schemars(crate = "rmcp::schemars")]
pub struct DraftIdArgs {
    /// The draft id returned by create_draft / list_drafts.
    pub id: String,
}

#[derive(Deserialize, JsonSchema)]
#[schemars(crate = "rmcp::schemars")]
pub struct ListDraftsArgs {
    /// Filter by status: "pending" or "discarded". Omit for all.
    #[serde(default)]
    pub status: Option<String>,
    /// Filter by target_type: modifier / composition / macro / alignment_phrase.
    #[serde(default)]
    pub target_type: Option<String>,
    /// Max rows (default 50, capped at 100).
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Deserialize, JsonSchema)]
#[schemars(crate = "rmcp::schemars")]
pub struct UpdateDraftArgs {
    /// The draft id to revise. Must still be pending.
    pub id: String,
    /// The replacement body, tagged by `target_type`.
    pub payload: PayloadArg,
}

#[derive(Deserialize, JsonSchema)]
#[schemars(crate = "rmcp::schemars")]
pub struct BootstrapArgs {
    /// A markdown document; each `#`/`##` section becomes one Macro draft.
    pub markdown_content: String,
    /// The protocol phase every produced draft is bound to.
    pub phase_id: String,
    #[serde(default)]
    pub provenance: Option<ProvenanceArg>,
}

#[derive(Deserialize, JsonSchema)]
#[schemars(crate = "rmcp::schemars")]
pub struct SaveConversationArgs {
    /// The conversation snippet to stage as a Macro.
    pub transcript: String,
    /// The protocol phase the macro is bound to.
    pub phase_id: String,
    /// Optional name; if omitted, derived from the first line of the transcript.
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub provenance: Option<ProvenanceArg>,
}

#[derive(Deserialize, JsonSchema)]
#[schemars(crate = "rmcp::schemars")]
pub struct ImportItem {
    pub payload: PayloadArg,
    #[serde(default)]
    pub provenance: Option<ProvenanceArg>,
}

#[derive(Deserialize, JsonSchema)]
#[schemars(crate = "rmcp::schemars")]
pub struct ImportJsonArgs {
    /// Up to 100 drafts to stage in one all-or-nothing batch. Duplicates are
    /// skipped (not failures); any other error rolls back the whole batch.
    pub items: Vec<ImportItem>,
}

#[derive(Deserialize, JsonSchema)]
#[schemars(crate = "rmcp::schemars")]
pub struct PhaseFilterArgs {
    /// Optional phase id to filter by.
    #[serde(default)]
    pub phase_id: Option<String>,
}

#[derive(Deserialize, JsonSchema)]
#[schemars(crate = "rmcp::schemars")]
pub struct PhaseSceneFilterArgs {
    #[serde(default)]
    pub phase_id: Option<String>,
    #[serde(default)]
    pub scene_id: Option<String>,
}

#[derive(Deserialize, JsonSchema)]
#[schemars(crate = "rmcp::schemars")]
pub struct SceneFilterArgs {
    #[serde(default)]
    pub scene_id: Option<String>,
}

// Lean read-tool projections: id + name + a short content preview, so listing
// existing assets to avoid duplicates doesn't ship full bodies.
#[derive(Serialize)]
struct ModifierBrief {
    id: String,
    name: String,
    group_kind: String,
    content_preview: String,
}

#[derive(Serialize)]
struct MacroBrief {
    id: String,
    name: String,
    scene_id: Option<String>,
    content_preview: String,
}

#[derive(Serialize)]
struct SceneBrief {
    id: String,
    name: String,
}

#[derive(Serialize)]
struct ImportReport {
    created: Vec<String>,
    skipped: Vec<ImportSkip>,
}

#[derive(Serialize)]
struct ImportSkip {
    index: usize,
    reason: String,
    existing_id: Option<String>,
}

fn preview(s: &str, max: usize) -> String {
    if s.chars().count() > max {
        let head: String = s.chars().take(max).collect();
        format!("{head}…")
    } else {
        s.to_string()
    }
}

#[derive(Clone)]
pub struct Hub {
    db: Arc<Mutex<Connection>>,
    // Rolling log of import_json call instants for the per-hour quota. In-memory
    // only: a process restart resets it (plan §5.2, decision 3b).
    import_log: Arc<Mutex<Vec<Instant>>>,
    tool_router: ToolRouter<Self>,
}

#[tool_router]
impl Hub {
    pub fn new(db: Connection) -> Self {
        Self {
            db: Arc::new(Mutex::new(db)),
            import_log: Arc::new(Mutex::new(Vec::new())),
            tool_router: Self::tool_router(),
        }
    }

    #[tool(description = "Health check: open the database and echo a message back.")]
    async fn echo(
        &self,
        Parameters(EchoArgs { msg }): Parameters<EchoArgs>,
    ) -> Result<CallToolResult, McpError> {
        let reachable = {
            let conn = self.db.lock().unwrap_or_else(|e| e.into_inner());
            conn.query_row("SELECT 1", [], |row| row.get::<_, i64>(0))
                .map(|n| n == 1)
                .unwrap_or(false)
        };
        Ok(CallToolResult::success(vec![Content::text(format!(
            "{msg} (db_reachable={reachable})"
        ))]))
    }

    // --- Draft CRUD (plan §5.1) ------------------------------------------

    #[tool(
        description = "Stage one prompt asset into the drafts inbox for the user to \
                       promote. The payload is tagged by target_type (modifier / \
                       composition / macro / alignment_phrase). Returns the new draft id."
    )]
    async fn create_draft(
        &self,
        Parameters(args): Parameters<CreateDraftArgs>,
    ) -> Result<CallToolResult, McpError> {
        if let Err(msg) = args.payload.validate() {
            return Ok(invalid_input(msg));
        }
        let payload = args.payload.into();
        let provenance = match args
            .provenance
            .unwrap_or_default()
            .into_provenance("create_draft")
        {
            Ok(p) => p,
            Err(msg) => return Ok(invalid_input(msg)),
        };
        let conn = self.db.lock().unwrap_or_else(|e| e.into_inner());
        match conn.create_draft(&payload, &provenance) {
            Ok(id) => Ok(json_ok(&serde_json::json!({ "draft_id": id }))),
            Err(e) => Ok(repo_error(e)),
        }
    }

    #[tool(
        description = "Fetch one draft in full (payload + provenance + status + \
                       timestamps). Call this after list_drafts to read the body before \
                       update_draft."
    )]
    async fn get_draft(
        &self,
        Parameters(DraftIdArgs { id }): Parameters<DraftIdArgs>,
    ) -> Result<CallToolResult, McpError> {
        let conn = self.db.lock().unwrap_or_else(|e| e.into_inner());
        match conn.get_draft(&id) {
            Ok(Some(draft)) => Ok(json_ok(&draft)),
            Ok(None) => Ok(repo_error(RepoError::DraftNotFound(id))),
            Err(e) => Ok(repo_error(e)),
        }
    }

    #[tool(
        description = "List drafts as lightweight summaries (id, target_type, name, \
                       preview, tool, status, created_at) — never full bodies. Filter by \
                       status and/or target_type."
    )]
    async fn list_drafts(
        &self,
        Parameters(args): Parameters<ListDraftsArgs>,
    ) -> Result<CallToolResult, McpError> {
        let status = match args.status.as_deref().map(DraftStatus::parse) {
            None => None,
            Some(Some(s)) => Some(s),
            Some(None) => {
                return Ok(invalid_input(
                    "status must be 'pending' or 'discarded'. Omit it to list all.",
                ))
            }
        };
        let target_type = match args.target_type.as_deref().map(DraftTargetType::parse) {
            None => None,
            Some(Some(t)) => Some(t),
            Some(None) => {
                return Ok(invalid_input(
                    "target_type must be modifier / composition / macro / \
                     alignment_phrase. Omit it to list all.",
                ))
            }
        };
        let limit = args
            .limit
            .unwrap_or(DEFAULT_DRAFT_LIMIT)
            .clamp(1, MAX_DRAFT_LIMIT);

        let conn = self.db.lock().unwrap_or_else(|e| e.into_inner());
        match conn.list_drafts(status, target_type, limit) {
            Ok(rows) => Ok(json_ok(&rows)),
            Err(e) => Ok(repo_error(e)),
        }
    }

    #[tool(
        description = "Replace the body of a pending draft. Fails if the draft is \
                       missing or already discarded/promoted."
    )]
    async fn update_draft(
        &self,
        Parameters(UpdateDraftArgs { id, payload }): Parameters<UpdateDraftArgs>,
    ) -> Result<CallToolResult, McpError> {
        if let Err(msg) = payload.validate() {
            return Ok(invalid_input(msg));
        }
        let payload = payload.into();
        let conn = self.db.lock().unwrap_or_else(|e| e.into_inner());
        match conn.update_draft(&id, &payload) {
            Ok(()) => Ok(json_ok(&serde_json::json!({ "ok": true, "draft_id": id }))),
            Err(e) => Ok(repo_error(e)),
        }
    }

    #[tool(
        description = "Withdraw a pending draft (marks it discarded; it won't be \
                       promotable). Frees the dedup slot so the same payload can be \
                       staged again later."
    )]
    async fn delete_draft(
        &self,
        Parameters(DraftIdArgs { id }): Parameters<DraftIdArgs>,
    ) -> Result<CallToolResult, McpError> {
        let conn = self.db.lock().unwrap_or_else(|e| e.into_inner());
        match conn.mark_discarded(&id) {
            Ok(()) => Ok(json_ok(&serde_json::json!({ "ok": true, "draft_id": id }))),
            Err(e) => Ok(repo_error(e)),
        }
    }

    // --- Helpers (plan §5.2) ---------------------------------------------

    #[tool(
        description = "Parse a markdown document into one Macro draft per `#`/`##` \
                       section (heading = name, body = content), all bound to phase_id. \
                       Returns the created draft ids and any skipped duplicates."
    )]
    async fn bootstrap_from_markdown(
        &self,
        Parameters(args): Parameters<BootstrapArgs>,
    ) -> Result<CallToolResult, McpError> {
        let sections = split_markdown_sections(&args.markdown_content);
        if sections.is_empty() {
            return Ok(invalid_input(
                "No `#`/`##` headings found, so there's nothing to stage. Give the \
                 document at least one heading per draft.",
            ));
        }
        let provenance = match args
            .provenance
            .unwrap_or_default()
            .into_provenance("bootstrap_from_markdown")
        {
            Ok(p) => p,
            Err(msg) => return Ok(invalid_input(msg)),
        };

        let mut created = Vec::new();
        let mut skipped = Vec::new();
        let conn = self.db.lock().unwrap_or_else(|e| e.into_inner());
        for (index, (name, content)) in sections.into_iter().enumerate() {
            let payload = PayloadArg::Macro {
                schema_version: 1,
                name,
                content,
                phase_id: args.phase_id.clone(),
                scene_id: None,
            }
            .into();
            match conn.create_draft(&payload, &provenance) {
                Ok(id) => created.push(id),
                Err(RepoError::DuplicateDraft { existing_id }) => skipped.push(ImportSkip {
                    index,
                    reason: "duplicate of an existing pending draft".to_string(),
                    existing_id: Some(existing_id),
                }),
                Err(e) => return Ok(repo_error(e)),
            }
        }
        Ok(json_ok(&ImportReport { created, skipped }))
    }

    #[tool(
        description = "Stage a conversation snippet as a Macro draft (the highest-\
                       frequency path). If name is omitted it's derived from the first \
                       line. Returns the new draft id."
    )]
    async fn save_conversation_as_macro(
        &self,
        Parameters(args): Parameters<SaveConversationArgs>,
    ) -> Result<CallToolResult, McpError> {
        let name = args.name.unwrap_or_else(|| {
            let first = args
                .transcript
                .lines()
                .find(|l| !l.trim().is_empty())
                .unwrap_or("Untitled macro")
                .trim();
            preview(first, 60)
        });
        let payload = PayloadArg::Macro {
            schema_version: 1,
            name,
            content: args.transcript,
            phase_id: args.phase_id,
            scene_id: None,
        }
        .into();
        let provenance = match args
            .provenance
            .unwrap_or_default()
            .into_provenance("save_conversation_as_macro")
        {
            Ok(p) => p,
            Err(msg) => return Ok(invalid_input(msg)),
        };
        let conn = self.db.lock().unwrap_or_else(|e| e.into_inner());
        match conn.create_draft(&payload, &provenance) {
            Ok(id) => Ok(json_ok(&serde_json::json!({ "draft_id": id }))),
            Err(e) => Ok(repo_error(e)),
        }
    }

    #[tool(
        description = "Bulk-stage up to 100 drafts in one all-or-nothing transaction. \
                       Duplicates are skipped and reported; any other error rolls the \
                       whole batch back. Rate-limited to 5 calls/hour."
    )]
    async fn import_json(
        &self,
        Parameters(ImportJsonArgs { items }): Parameters<ImportJsonArgs>,
    ) -> Result<CallToolResult, McpError> {
        if items.is_empty() {
            return Ok(invalid_input("items is empty — nothing to import."));
        }
        if items.len() > MAX_IMPORT_BATCH {
            return Ok(invalid_input(format!(
                "batch of {} exceeds the {MAX_IMPORT_BATCH}-item limit. Split it into \
                 smaller batches.",
                items.len()
            )));
        }

        // Quota: prune timestamps older than an hour, then refuse if we're at cap.
        {
            let mut log = self.import_log.lock().unwrap_or_else(|e| e.into_inner());
            let now = Instant::now();
            log.retain(|t| now.duration_since(*t) < IMPORT_QUOTA_WINDOW);
            if log.len() >= IMPORT_QUOTA_PER_HOUR {
                return Ok(invalid_input(format!(
                    "import_json is rate-limited to {IMPORT_QUOTA_PER_HOUR} calls/hour \
                     and you've hit the cap. Stage drafts with create_draft, or wait."
                )));
            }
            log.push(now);
        }

        // Convert + size-check up front so an oversize payload fails the batch
        // before we open a transaction.
        let mut payloads = Vec::with_capacity(items.len());
        for (index, item) in items.into_iter().enumerate() {
            if let Err(msg) = item.payload.validate() {
                return Ok(invalid_input(format!("item {index}: {msg}")));
            }
            let payload: repo_core::models::DraftPayload = item.payload.into();
            let bytes = serde_json::to_string(&payload)
                .map(|s| s.len())
                .unwrap_or(usize::MAX);
            if bytes > MAX_PAYLOAD_BYTES {
                return Ok(invalid_input(format!(
                    "item {index} is {bytes} bytes, over the {MAX_PAYLOAD_BYTES}-byte \
                     per-payload limit. Trim it and retry."
                )));
            }
            let provenance = match item
                .provenance
                .unwrap_or_default()
                .into_provenance("bulk_import")
            {
                Ok(p) => p,
                Err(msg) => return Ok(invalid_input(format!("item {index}: {msg}"))),
            };
            payloads.push((payload, provenance));
        }

        let conn = self.db.lock().unwrap_or_else(|e| e.into_inner());
        let tx = match conn.unchecked_transaction() {
            Ok(tx) => tx,
            Err(e) => return Ok(repo_error(RepoError::Sqlite(e))),
        };

        let mut created = Vec::new();
        let mut skipped = Vec::new();
        for (index, (payload, provenance)) in payloads.iter().enumerate() {
            match tx.create_draft(payload, provenance) {
                Ok(id) => created.push(id),
                Err(RepoError::DuplicateDraft { existing_id }) => skipped.push(ImportSkip {
                    index,
                    reason: "duplicate of an existing pending draft".to_string(),
                    existing_id: Some(existing_id),
                }),
                // Any hard error rolls the whole batch back (tx drops un-committed).
                Err(e) => return Ok(repo_error(e)),
            }
        }
        if let Err(e) = tx.commit() {
            return Ok(repo_error(RepoError::Sqlite(e)));
        }
        Ok(json_ok(&ImportReport { created, skipped }))
    }

    // --- Read (plan §5.3) ------------------------------------------------

    #[tool(
        description = "List protocol phases (id, name, order). Read this before \
                          choosing a phase_id."
    )]
    async fn list_phases(&self) -> Result<CallToolResult, McpError> {
        let conn = self.db.lock().unwrap_or_else(|e| e.into_inner());
        match conn.list_phases() {
            Ok(rows) => Ok(json_ok(&rows)),
            Err(e) => Ok(repo_error(e)),
        }
    }

    #[tool(description = "List alignment phrases, optionally filtered by phase_id.")]
    async fn list_alignment_phrases(
        &self,
        Parameters(PhaseFilterArgs { phase_id }): Parameters<PhaseFilterArgs>,
    ) -> Result<CallToolResult, McpError> {
        let conn = self.db.lock().unwrap_or_else(|e| e.into_inner());
        match conn.list_alignment_phrases() {
            Ok(rows) => {
                let rows: Vec<_> = rows
                    .into_iter()
                    .filter(|p| phase_id.as_ref().is_none_or(|id| &p.phase_id == id))
                    .collect();
                Ok(json_ok(&rows))
            }
            Err(e) => Ok(repo_error(e)),
        }
    }

    #[tool(
        description = "List modifiers as briefs (id, name, group_kind, content preview) \
                       so you can reuse one instead of staging a duplicate."
    )]
    async fn list_modifiers(&self) -> Result<CallToolResult, McpError> {
        let conn = self.db.lock().unwrap_or_else(|e| e.into_inner());
        match conn.list_modifiers() {
            Ok(rows) => {
                let briefs: Vec<ModifierBrief> = rows
                    .into_iter()
                    .map(|m| ModifierBrief {
                        id: m.id,
                        name: m.name,
                        group_kind: m.group_kind,
                        content_preview: preview(&m.content, PREVIEW_CHARS),
                    })
                    .collect();
                Ok(json_ok(&briefs))
            }
            Err(e) => Ok(repo_error(e)),
        }
    }

    #[tool(
        description = "List compositions, optionally filtered by phase_id and/or \
                          scene_id."
    )]
    async fn list_compositions(
        &self,
        Parameters(PhaseSceneFilterArgs { phase_id, scene_id }): Parameters<PhaseSceneFilterArgs>,
    ) -> Result<CallToolResult, McpError> {
        let conn = self.db.lock().unwrap_or_else(|e| e.into_inner());
        match conn.list_compositions() {
            Ok(rows) => {
                let rows: Vec<_> = rows
                    .into_iter()
                    .filter(|c| phase_id.as_ref().is_none_or(|id| &c.phase_id == id))
                    .filter(|c| {
                        scene_id
                            .as_ref()
                            .is_none_or(|id| c.scene_id.as_ref() == Some(id))
                    })
                    .collect();
                Ok(json_ok(&rows))
            }
            Err(e) => Ok(repo_error(e)),
        }
    }

    #[tool(
        description = "List macros as briefs (id, name, scene_id, content preview), \
                       optionally filtered by scene_id, so you can reuse one instead of \
                       staging a duplicate."
    )]
    async fn list_macros(
        &self,
        Parameters(SceneFilterArgs { scene_id }): Parameters<SceneFilterArgs>,
    ) -> Result<CallToolResult, McpError> {
        let conn = self.db.lock().unwrap_or_else(|e| e.into_inner());
        match conn.list_macros() {
            Ok(rows) => {
                let briefs: Vec<MacroBrief> = rows
                    .into_iter()
                    .filter(|m| {
                        scene_id
                            .as_ref()
                            .is_none_or(|id| m.scene_id.as_ref() == Some(id))
                    })
                    .map(|m| MacroBrief {
                        id: m.id,
                        name: m.name,
                        scene_id: m.scene_id,
                        content_preview: preview(&m.content, PREVIEW_CHARS),
                    })
                    .collect();
                Ok(json_ok(&briefs))
            }
            Err(e) => Ok(repo_error(e)),
        }
    }

    #[tool(description = "List scenes (id, name). Read this before choosing a scene_id.")]
    async fn list_scenes(&self) -> Result<CallToolResult, McpError> {
        let conn = self.db.lock().unwrap_or_else(|e| e.into_inner());
        match conn.list_scenes_with_children() {
            Ok(rows) => {
                let briefs: Vec<SceneBrief> = rows
                    .into_iter()
                    .map(|s| SceneBrief {
                        id: s.scene.id,
                        name: s.scene.name,
                    })
                    .collect();
                Ok(json_ok(&briefs))
            }
            Err(e) => Ok(repo_error(e)),
        }
    }
}

// `router = self.tool_router` reads the router built once in `new()`; the bare
// `#[tool_handler]` would instead call `Self::tool_router()` per request and
// leave the stored field unread (dead code).
#[tool_handler(router = self.tool_router)]
impl ServerHandler for Hub {
    fn get_info(&self) -> ServerInfo {
        // ServerInfo is #[non_exhaustive], so build from default + assign.
        let mut info = ServerInfo::default();
        info.protocol_version = ProtocolVersion::V_2025_06_18;
        info.capabilities = ServerCapabilities::builder().enable_tools().build();
        info.server_info = Implementation::from_build_env();
        info.instructions = Some(
            "prompt-hub draft staging. Write prompt assets into the drafts inbox; \
             the user promotes them in the desktop app. Use the list_* tools to see \
             existing assets before creating duplicates."
                .to_string(),
        );
        info
    }
}
