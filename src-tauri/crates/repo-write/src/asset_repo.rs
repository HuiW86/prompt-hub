use chrono::Utc;
use rusqlite::{params, Connection};
use uuid::Uuid;

use repo_core::error::RepoResult;

/// Inserts into the real asset tables. Lives in `repo-write` so the MCP binary
/// (repo-core only) can't reach it. Implemented for `rusqlite::Connection`;
/// because `Transaction` derefs to `Connection`, the same methods run inside the
/// promote transaction (see `promote.rs`).
pub trait AssetRepo {
    fn insert_composition(
        &self,
        name: &str,
        modifier_ids: &[String],
        phase_id: &str,
        scene_id: Option<&str>,
    ) -> RepoResult<String>;

    fn insert_alignment_phrase(
        &self,
        name: &str,
        content: &str,
        phase_id: &str,
        is_default: bool,
    ) -> RepoResult<String>;
}

impl AssetRepo for Connection {
    fn insert_composition(
        &self,
        name: &str,
        modifier_ids: &[String],
        phase_id: &str,
        scene_id: Option<&str>,
    ) -> RepoResult<String> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let modifier_ids_json = serde_json::to_string(modifier_ids)?;
        self.execute(
            "INSERT INTO compositions
                (id, name, modifier_ids, phase_id, scene_id, usage_count,
                 last_used_at, created_at, notes, deprecated)
             VALUES (?1, ?2, ?3, ?4, ?5, 0, NULL, ?6, NULL, 0)",
            params![id, name, modifier_ids_json, phase_id, scene_id, now],
        )?;
        Ok(id)
    }

    fn insert_alignment_phrase(
        &self,
        name: &str,
        content: &str,
        phase_id: &str,
        is_default: bool,
    ) -> RepoResult<String> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        self.execute(
            "INSERT INTO alignment_phrases
                (id, phase_id, name, content, is_default, usage_count,
                 last_used_at, created_at, notes, deprecated)
             VALUES (?1, ?2, ?3, ?4, ?5, 0, NULL, ?6, NULL, 0)",
            params![id, phase_id, name, content, is_default as i64, now],
        )?;
        Ok(id)
    }
}
