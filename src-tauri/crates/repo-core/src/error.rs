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
    #[error("{0}")]
    Other(String),
}

pub type RepoResult<T> = Result<T, RepoError>;
