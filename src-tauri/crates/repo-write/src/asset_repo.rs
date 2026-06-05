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

    fn insert_modifier(&self, name: &str, content: &str, group_kind: &str) -> RepoResult<String>;

    fn insert_macro(&self, name: &str, content: &str, scene_id: Option<&str>)
        -> RepoResult<String>;
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
                 last_used_at, created_at, notes, deprecated, order_index)
             VALUES (?1, ?2, ?3, ?4, ?5, 0, NULL, ?6, NULL, 0,
                 (SELECT COALESCE(MAX(order_index) + 1, 0) FROM compositions WHERE phase_id = ?4))",
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
                 last_used_at, created_at, notes, deprecated, order_index)
             VALUES (?1, ?2, ?3, ?4, ?5, 0, NULL, ?6, NULL, 0,
                 (SELECT COALESCE(MAX(order_index) + 1, 0) FROM alignment_phrases WHERE phase_id = ?2))",
            params![id, phase_id, name, content, is_default as i64, now],
        )?;
        Ok(id)
    }

    // The draft payload's phase_id/scene_id are dropped: a Modifier is a
    // phase-independent building block (PRD §4.2). group_kind is supplied at
    // promote time (decision iii); the schema CHECK rejects an invalid value.
    fn insert_modifier(&self, name: &str, content: &str, group_kind: &str) -> RepoResult<String> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        self.execute(
            "INSERT INTO modifiers
                (id, name, content, group_kind, usage_count,
                 last_used_at, created_at, notes, deprecated, order_index)
             VALUES (?1, ?2, ?3, ?4, 0, NULL, ?5, NULL, 0,
                 (SELECT COALESCE(MAX(order_index) + 1, 0) FROM modifiers WHERE group_kind = ?4))",
            params![id, name, content, group_kind, now],
        )?;
        Ok(id)
    }

    // The draft payload's phase_id is dropped (macros has no such column); the
    // macro is archived by scene_id. A promoted macro is always non-native
    // (native=0, expand_from/role/task NULL), satisfying the table CHECK.
    fn insert_macro(
        &self,
        name: &str,
        content: &str,
        scene_id: Option<&str>,
    ) -> RepoResult<String> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        self.execute(
            "INSERT INTO macros
                (id, name, content, expand_from, native, role, task,
                 usage_count, last_used_at, created_at, notes, scene_id, deprecated, order_index)
             VALUES (?1, ?2, ?3, NULL, 0, NULL, NULL, 0, NULL, ?4, NULL, ?5, 0,
                 (SELECT COALESCE(MAX(order_index) + 1, 0) FROM macros))",
            params![id, name, content, now, scene_id],
        )?;
        Ok(id)
    }
}
