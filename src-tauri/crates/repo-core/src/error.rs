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
    // A Modifier promote needs a group_kind the draft payload doesn't carry: the
    // four-quadrant classification (cognition/action/delivery/constraint) is
    // omar's call at promote time, supplied via PromoteOptions (decision iii).
    #[error("promote of `{target_type}` requires `{field}` to be supplied")]
    PromoteMissingField { target_type: String, field: String },
    // D-c: an alignment phrase marked is_default=1 is the phase's protocol
    // default and may not be hard-deleted (every phase must keep exactly one).
    #[error("alignment phrase `{0}` is its phase default and cannot be deleted")]
    DefaultAlignmentPhraseProtected(String),
    // D4 (plan scene-substage-editing): a Scene still containing phrases or
    // sub-stages may not be deleted — the app-layer check refuses rather than
    // orphan children. Surfaces over IPC as a plain message so the renderer can
    // tell the user to empty the scene first.
    #[error("scene `{scene_id}` is not empty (has phrases or sub-stages) and cannot be deleted")]
    SceneNotEmpty { scene_id: String },
    // PRD §10.1.1: drafts.payload_json is capped at 64KB. Enforced at the repo
    // layer so every single-write path (MCP create/update, Tauri IPC) shares it.
    #[error("payload is {size_bytes} bytes, over the {limit_bytes}-byte limit")]
    PayloadTooLarge {
        size_bytes: usize,
        limit_bytes: usize,
    },
    #[error("{0}")]
    Other(String),
}

pub type RepoResult<T> = Result<T, RepoError>;
