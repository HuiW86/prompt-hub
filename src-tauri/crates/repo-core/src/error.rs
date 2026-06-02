// Error type for the Tauri-free data layer. The Tauri binary wraps this in its
// own AppError (which adds a tauri::Error variant + IPC Serialize). Keeping the
// data-layer error free of tauri::Error is what lets prompt-hub-mcp reuse it.
#[derive(Debug, thiserror::Error)]
pub enum RepoError {
    #[error("sqlite: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("serde: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("target_id `{target_id}` not found in `{table}`")]
    TargetNotFound { table: String, target_id: String },
    #[error("target_id required for target_type `{0}`")]
    TargetIdRequired(String),
    // R1: a read-only consumer (MCP server) opened a DB whose schema version
    // doesn't match what this binary was built against. Refuse rather than
    // read a half-migrated or future schema.
    #[error("db schema version mismatch: found {found}, expected {expected} — open the prompt-hub main app to migrate the database first")]
    SchemaVersionMismatch { found: u32, expected: u32 },
    // A pending draft with the same payload_hash already exists. The MCP layer
    // surfaces `existing_id` so the caller can get_draft / promote it instead of
    // re-creating a duplicate (plan §5.2 import_json dedup).
    #[error("a pending draft with identical payload already exists: {existing_id}")]
    DuplicateDraft { existing_id: String },
    #[error("draft `{0}` not found")]
    DraftNotFound(String),
    // The draft is not in a promotable state (e.g. already discarded), so the
    // promote transaction refuses to run.
    #[error("draft `{id}` is not pending (status: {status})")]
    DraftNotPending { id: String, status: String },
    // Modifier/Macro promote is not wired up yet: PRD §10.1.2 payloads carry a
    // phase_id, but the modifiers/macros tables have no such column and
    // modifiers.group_kind is required but absent from the payload. Blocked on
    // omar's field-mapping decision; Composition/AlignmentPhrase already work.
    #[error("promote not yet supported for target_type `{0}` (pending field-mapping decision)")]
    PromoteUnsupported(String),
    #[error("{0}")]
    Other(String),
}

pub type RepoResult<T> = Result<T, RepoError>;
