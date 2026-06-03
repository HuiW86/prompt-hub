//! AI-friendly error responses (plan §5.4). Every failure becomes a
//! `CallToolResult` with `is_error = true` carrying a plain-text message shaped
//! as *what + why + suggested next tool*, NOT a JSON-RPC protocol error — the
//! client swallows those, so the model never sees them and can't self-correct.

use repo_core::error::RepoError;
use rmcp::model::{CallToolResult, Content};

/// Render a `RepoError` as a tool-level error result the model can read and act
/// on. Each arm names the next tool to call so Claude recovers without a human.
pub fn repo_error(err: RepoError) -> CallToolResult {
    let text = match err {
        RepoError::DuplicateDraft { existing_id } => format!(
            "An identical pending draft already exists (id: {existing_id}). \
             Don't create a duplicate — call get_draft to inspect it, or \
             update_draft to revise it."
        ),
        RepoError::DraftNotFound(id) => format!(
            "No draft with id '{id}'. Call list_drafts to see the pending \
             drafts and their ids, then retry with a valid id."
        ),
        RepoError::DraftNotPending { id, status } => format!(
            "Draft '{id}' is '{status}', not pending, so it can't be edited or \
             discarded. Call list_drafts with status=pending to find editable \
             drafts."
        ),
        RepoError::TargetNotFound { table, target_id } => format!(
            "'{target_id}' was not found in {table}. Call the matching list_* \
             tool (e.g. list_phases / list_scenes) to get a valid id, then retry."
        ),
        RepoError::TargetIdRequired(target_type) => format!(
            "A target id is required for target_type '{target_type}'. Supply the \
             id from the relevant list_* tool."
        ),
        RepoError::SchemaVersionMismatch { found, expected } => format!(
            "The database schema is out of date (found v{found}, this server \
             expects v{expected}). Open the prompt-hub desktop app once to \
             migrate the database, then reconnect."
        ),
        RepoError::PromoteMissingField { target_type, field } => format!(
            "Promoting '{target_type}' needs '{field}', which happens in the \
             desktop app, not here. Stage the draft and let the user promote it."
        ),
        RepoError::Serde(e) => format!(
            "The payload couldn't be parsed: {e}. Check that the fields match \
             the target_type (e.g. a modifier needs name, content, phase_id)."
        ),
        RepoError::Sqlite(e) => format!(
            "Unexpected database error: {e}. This is not something you can fix \
             by retrying with different input; report it to the user."
        ),
        RepoError::Io(e) => format!("Unexpected I/O error: {e}."),
        RepoError::Other(msg) => msg,
    };
    CallToolResult::error(vec![Content::text(text)])
}

/// A plain tool-level error from a string reason (used for input validation that
/// happens before we reach the repo layer, e.g. an unknown status filter).
pub fn invalid_input(reason: impl Into<String>) -> CallToolResult {
    CallToolResult::error(vec![Content::text(reason.into())])
}

/// Serialize a serializable value into a successful JSON text result. Falls back
/// to an error result if serialization itself fails (should be unreachable for
/// our owned types).
pub fn json_ok<T: serde::Serialize>(value: &T) -> CallToolResult {
    match serde_json::to_string(value) {
        Ok(json) => CallToolResult::success(vec![Content::text(json)]),
        Err(e) => CallToolResult::error(vec![Content::text(format!(
            "internal: failed to serialize result: {e}"
        ))]),
    }
}
