use chrono::Utc;
use rusqlite::{params, Connection, ErrorCode, OptionalExtension};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::error::{RepoError, RepoResult};
use crate::models::{Draft, DraftPayload, DraftStatus, DraftSummary, DraftTargetType, Provenance};
use crate::repo::parse_ts;

/// Staging-inbox operations the MCP server is allowed to perform. Promotion into
/// the real asset tables lives in `repo-write::AssetRepo`, which the MCP binary
/// can't depend on — that crate boundary is the write-isolation guarantee
/// (plan §3.3), not a runtime check.
pub trait DraftRepo {
    fn create_draft(&self, payload: &DraftPayload, provenance: &Provenance) -> RepoResult<String>;
    fn get_draft(&self, id: &str) -> RepoResult<Option<Draft>>;
    fn list_drafts(
        &self,
        status: Option<DraftStatus>,
        target_type: Option<DraftTargetType>,
        limit: i64,
    ) -> RepoResult<Vec<DraftSummary>>;
    fn update_draft(&self, id: &str, payload: &DraftPayload) -> RepoResult<()>;
    fn mark_discarded(&self, id: &str) -> RepoResult<()>;
}

// PRD §10.1.1: payload_json ≤ 64KB. Single source of truth for every write
// path — import_json (MCP batch) and create/update_draft all check against it.
pub const MAX_PAYLOAD_BYTES: usize = 64 * 1024;

fn check_payload_size(payload_json: &str) -> RepoResult<()> {
    if payload_json.len() > MAX_PAYLOAD_BYTES {
        return Err(RepoError::PayloadTooLarge {
            size_bytes: payload_json.len(),
            limit_bytes: MAX_PAYLOAD_BYTES,
        });
    }
    Ok(())
}

pub fn sha256_hex(s: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(s.as_bytes());
    let digest = hasher.finalize();
    let mut out = String::with_capacity(digest.len() * 2);
    for byte in digest {
        out.push_str(&format!("{byte:02x}"));
    }
    out
}

/// Count of pending drafts — drives the main-form 待审 badge (PRD §10.3,
/// budget ≤ 1ms). A free fn rather than a `DraftRepo` method so the MCP server's
/// allowed write surface (the trait) doesn't grow a Tauri-only read.
pub fn count_pending_drafts(conn: &Connection) -> RepoResult<u32> {
    let count: u32 = conn.query_row(
        "SELECT COUNT(*) FROM drafts WHERE status = 'pending'",
        [],
        |row| row.get(0),
    )?;
    Ok(count)
}

fn is_unique_violation(err: &rusqlite::Error) -> bool {
    matches!(
        err,
        rusqlite::Error::SqliteFailure(e, _) if e.code == ErrorCode::ConstraintViolation
    )
}

impl DraftRepo for Connection {
    fn create_draft(&self, payload: &DraftPayload, provenance: &Provenance) -> RepoResult<String> {
        let payload_json = serde_json::to_string(payload)?;
        check_payload_size(&payload_json)?;
        let payload_hash = sha256_hex(&payload_json);
        let provenance_json = serde_json::to_string(provenance)?;
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        let res = self.execute(
            "INSERT INTO drafts
                (id, target_type, schema_version, payload_json, payload_hash,
                 provenance, status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending', ?7, ?7)",
            params![
                id,
                payload.target_type().as_str(),
                payload.schema_version(),
                payload_json,
                payload_hash,
                provenance_json,
                now,
            ],
        );

        match res {
            Ok(_) => Ok(id),
            Err(e) if is_unique_violation(&e) => {
                // The only UNIQUE index on drafts is idx_drafts_hash_pending, so
                // a violation means an identical pending draft already exists.
                let existing: Option<String> = self
                    .query_row(
                        "SELECT id FROM drafts WHERE payload_hash = ?1 AND status = 'pending'",
                        params![payload_hash],
                        |row| row.get(0),
                    )
                    .optional()?;
                match existing {
                    Some(existing_id) => Err(RepoError::DuplicateDraft { existing_id }),
                    None => Err(RepoError::Sqlite(e)),
                }
            }
            Err(e) => Err(RepoError::Sqlite(e)),
        }
    }

    fn get_draft(&self, id: &str) -> RepoResult<Option<Draft>> {
        let row = self
            .query_row(
                "SELECT id, target_type, schema_version, payload_json, payload_hash,
                        provenance, status, created_at, updated_at
                 FROM drafts WHERE id = ?1",
                params![id],
                |row| {
                    Ok((
                        row.get::<_, String>("id")?,
                        row.get::<_, String>("target_type")?,
                        row.get::<_, u32>("schema_version")?,
                        row.get::<_, String>("payload_json")?,
                        row.get::<_, String>("payload_hash")?,
                        row.get::<_, String>("provenance")?,
                        row.get::<_, String>("status")?,
                        row.get::<_, String>("created_at")?,
                        row.get::<_, String>("updated_at")?,
                    ))
                },
            )
            .optional()?;

        let Some((
            id,
            target_type_s,
            schema_version,
            payload_json,
            payload_hash,
            provenance_json,
            status_s,
            created,
            updated,
        )) = row
        else {
            return Ok(None);
        };

        let target_type = DraftTargetType::parse(&target_type_s).ok_or_else(|| {
            RepoError::Other(format!("unknown draft target_type: {target_type_s}"))
        })?;
        let status = DraftStatus::parse(&status_s)
            .ok_or_else(|| RepoError::Other(format!("unknown draft status: {status_s}")))?;
        let payload: DraftPayload = serde_json::from_str(&payload_json)?;
        let provenance: Provenance = serde_json::from_str(&provenance_json)?;

        Ok(Some(Draft {
            id,
            target_type,
            schema_version,
            payload,
            payload_hash,
            provenance,
            status,
            created_at: parse_ts(created)?,
            updated_at: parse_ts(updated)?,
        }))
    }

    fn list_drafts(
        &self,
        status: Option<DraftStatus>,
        target_type: Option<DraftTargetType>,
        limit: i64,
    ) -> RepoResult<Vec<DraftSummary>> {
        // Filter values come from closed Rust enums (as_str → 'static literals),
        // so inlining them carries no SQL-injection surface.
        let mut where_parts: Vec<String> = Vec::new();
        if let Some(s) = status {
            where_parts.push(format!("status = '{}'", s.as_str()));
        }
        if let Some(t) = target_type {
            where_parts.push(format!("target_type = '{}'", t.as_str()));
        }
        let where_sql = if where_parts.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", where_parts.join(" AND "))
        };
        let sql = format!(
            "SELECT id, target_type, payload_json, provenance, status, created_at
             FROM drafts {where_sql}
             ORDER BY created_at DESC
             LIMIT ?1"
        );

        let mut stmt = self.prepare(&sql)?;
        let raw = stmt.query_map(params![limit], |row| {
            Ok((
                row.get::<_, String>("id")?,
                row.get::<_, String>("target_type")?,
                row.get::<_, String>("payload_json")?,
                row.get::<_, String>("provenance")?,
                row.get::<_, String>("status")?,
                row.get::<_, String>("created_at")?,
            ))
        })?;

        let mut out = Vec::new();
        for r in raw {
            let (id, target_type_s, payload_json, provenance_json, status_s, created) = r?;
            let target_type = DraftTargetType::parse(&target_type_s).ok_or_else(|| {
                RepoError::Other(format!("unknown draft target_type: {target_type_s}"))
            })?;
            let status = DraftStatus::parse(&status_s)
                .ok_or_else(|| RepoError::Other(format!("unknown draft status: {status_s}")))?;
            let payload: DraftPayload = serde_json::from_str(&payload_json)?;
            let provenance: Provenance = serde_json::from_str(&provenance_json)?;
            out.push(DraftSummary {
                id,
                target_type,
                name: payload.name().to_string(),
                preview: payload.preview(),
                tool_name: provenance.tool_name,
                status,
                created_at: parse_ts(created)?,
            });
        }
        Ok(out)
    }

    fn update_draft(&self, id: &str, payload: &DraftPayload) -> RepoResult<()> {
        let payload_json = serde_json::to_string(payload)?;
        check_payload_size(&payload_json)?;
        let payload_hash = sha256_hex(&payload_json);
        let now = Utc::now().to_rfc3339();

        let res = self.execute(
            "UPDATE drafts
             SET target_type = ?1, schema_version = ?2, payload_json = ?3,
                 payload_hash = ?4, updated_at = ?5
             WHERE id = ?6 AND status = 'pending'",
            params![
                payload.target_type().as_str(),
                payload.schema_version(),
                payload_json,
                payload_hash,
                now,
                id,
            ],
        );

        match res {
            Ok(0) => Err(self.diagnose_unwritable(id)),
            Ok(_) => Ok(()),
            Err(e) if is_unique_violation(&e) => {
                let existing: Option<String> = self
                    .query_row(
                        "SELECT id FROM drafts
                         WHERE payload_hash = ?1 AND status = 'pending' AND id != ?2",
                        params![payload_hash, id],
                        |row| row.get(0),
                    )
                    .optional()?;
                match existing {
                    Some(existing_id) => Err(RepoError::DuplicateDraft { existing_id }),
                    None => Err(RepoError::Sqlite(e)),
                }
            }
            Err(e) => Err(RepoError::Sqlite(e)),
        }
    }

    fn mark_discarded(&self, id: &str) -> RepoResult<()> {
        let now = Utc::now().to_rfc3339();
        let affected = self.execute(
            "UPDATE drafts SET status = 'discarded', updated_at = ?1
             WHERE id = ?2 AND status = 'pending'",
            params![now, id],
        )?;
        if affected == 0 {
            return Err(self.diagnose_unwritable(id));
        }
        Ok(())
    }
}

// Private helper: a WHERE id=? AND status='pending' write that affects 0 rows
// either hit a missing draft or a non-pending one. One extra read tells them
// apart so callers get an actionable error instead of a silent no-op.
trait DraftDiagnose {
    fn diagnose_unwritable(&self, id: &str) -> RepoError;
}

impl DraftDiagnose for Connection {
    fn diagnose_unwritable(&self, id: &str) -> RepoError {
        let status: Option<String> = self
            .query_row(
                "SELECT status FROM drafts WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .optional()
            .unwrap_or(None);
        match status {
            Some(status) => RepoError::DraftNotPending {
                id: id.to_string(),
                status,
            },
            None => RepoError::DraftNotFound(id.to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    fn sample_provenance(tool: &str) -> Provenance {
        Provenance {
            source_app: "Claude Code".to_string(),
            conversation_ref: "conv-abc".to_string(),
            tool_name: tool.to_string(),
            model_hint: Some("claude-opus-4-7".to_string()),
            confidence: Some(0.9),
        }
    }

    fn macro_payload(name: &str) -> DraftPayload {
        DraftPayload::Macro {
            schema_version: 1,
            name: name.to_string(),
            content: "expand this prompt fully".to_string(),
            phase_id: "phase-1".to_string(),
            scene_id: None,
        }
    }

    #[test]
    fn create_then_get_roundtrips_payload_and_provenance() {
        let conn = db::open_in_memory().expect("open db");
        let payload = macro_payload("Deep Dive");
        let prov = sample_provenance("save_conversation_as_macro");

        let id = conn.create_draft(&payload, &prov).expect("create");
        let got = conn.get_draft(&id).expect("get").expect("present");

        assert_eq!(got.id, id);
        assert_eq!(got.target_type, DraftTargetType::Macro);
        assert_eq!(got.status, DraftStatus::Pending);
        assert_eq!(got.payload, payload);
        assert_eq!(got.provenance, prov);
        assert_eq!(got.payload_hash.len(), 64, "sha-256 hex is 64 chars");
    }

    #[test]
    fn create_oversize_payload_is_rejected() {
        let conn = db::open_in_memory().expect("open db");
        let mut payload = macro_payload("Huge");
        if let DraftPayload::Macro { content, .. } = &mut payload {
            *content = "x".repeat(MAX_PAYLOAD_BYTES + 1);
        }
        let err = conn
            .create_draft(&payload, &sample_provenance("create_draft"))
            .expect_err("oversize payload must be rejected");
        assert!(
            matches!(err, RepoError::PayloadTooLarge { size_bytes, limit_bytes }
                if size_bytes > MAX_PAYLOAD_BYTES && limit_bytes == MAX_PAYLOAD_BYTES),
            "expected PayloadTooLarge"
        );
    }

    #[test]
    fn update_oversize_payload_is_rejected_and_row_untouched() {
        let conn = db::open_in_memory().expect("open db");
        let payload = macro_payload("Small");
        let id = conn
            .create_draft(&payload, &sample_provenance("create_draft"))
            .expect("create");

        let mut big = macro_payload("Small");
        if let DraftPayload::Macro { content, .. } = &mut big {
            *content = "x".repeat(MAX_PAYLOAD_BYTES + 1);
        }
        let err = conn
            .update_draft(&id, &big)
            .expect_err("oversize update must be rejected");
        assert!(matches!(err, RepoError::PayloadTooLarge { .. }));

        let got = conn.get_draft(&id).expect("get").expect("present");
        assert_eq!(
            got.payload, payload,
            "row must be unchanged after rejection"
        );
    }

    #[test]
    fn get_missing_draft_returns_none() {
        let conn = db::open_in_memory().expect("open db");
        assert!(conn.get_draft("nope").expect("get").is_none());
    }

    #[test]
    fn create_duplicate_pending_payload_is_rejected_with_existing_id() {
        let conn = db::open_in_memory().expect("open db");
        let payload = macro_payload("Same");
        let prov = sample_provenance("create_draft");

        let first = conn.create_draft(&payload, &prov).expect("first");
        let err = conn
            .create_draft(&payload, &prov)
            .expect_err("identical pending payload must be rejected");
        assert!(
            matches!(&err, RepoError::DuplicateDraft { existing_id } if *existing_id == first),
            "expected DuplicateDraft pointing at {first}, got {err:?}"
        );
    }

    #[test]
    fn discarding_a_draft_frees_the_dedup_slot() {
        let conn = db::open_in_memory().expect("open db");
        let payload = macro_payload("Recyclable");
        let prov = sample_provenance("create_draft");

        let first = conn.create_draft(&payload, &prov).expect("first");
        conn.mark_discarded(&first).expect("discard");
        // The partial unique index only covers pending rows, so an identical
        // payload may be staged again once the prior one is discarded.
        conn.create_draft(&payload, &prov)
            .expect("re-create after discard");
    }

    #[test]
    fn list_drafts_filters_and_projects_summary() {
        let conn = db::open_in_memory().expect("open db");
        let m = conn
            .create_draft(&macro_payload("M1"), &sample_provenance("tool_a"))
            .expect("macro draft");
        let ap = DraftPayload::AlignmentPhrase {
            schema_version: 1,
            name: "Align".to_string(),
            content: "let's align on scope first".to_string(),
            phase_id: "phase-1".to_string(),
            is_default: false,
        };
        conn.create_draft(&ap, &sample_provenance("tool_b"))
            .expect("ap draft");

        let all = conn.list_drafts(None, None, 50).expect("list all");
        assert_eq!(all.len(), 2);

        let only_macro = conn
            .list_drafts(Some(DraftStatus::Pending), Some(DraftTargetType::Macro), 50)
            .expect("list macro");
        assert_eq!(only_macro.len(), 1);
        let summary = &only_macro[0];
        assert_eq!(summary.id, m);
        assert_eq!(summary.name, "M1");
        assert_eq!(summary.tool_name, "tool_a");
        assert!(!summary.preview.is_empty());
    }

    #[test]
    fn update_draft_changes_payload_and_hash() {
        let conn = db::open_in_memory().expect("open db");
        let id = conn
            .create_draft(&macro_payload("Before"), &sample_provenance("create_draft"))
            .expect("create");
        let before = conn.get_draft(&id).expect("get").expect("present");

        let updated = macro_payload("After");
        conn.update_draft(&id, &updated).expect("update");
        let after = conn.get_draft(&id).expect("get").expect("present");

        assert_eq!(after.payload, updated);
        assert_ne!(after.payload_hash, before.payload_hash);
    }

    #[test]
    fn count_pending_drafts_excludes_discarded() {
        let conn = db::open_in_memory().expect("open db");
        assert_eq!(count_pending_drafts(&conn).expect("count empty"), 0);

        let a = conn
            .create_draft(&macro_payload("A"), &sample_provenance("create_draft"))
            .expect("a");
        conn.create_draft(&macro_payload("B"), &sample_provenance("create_draft"))
            .expect("b");
        assert_eq!(count_pending_drafts(&conn).expect("count two"), 2);

        conn.mark_discarded(&a).expect("discard a");
        assert_eq!(
            count_pending_drafts(&conn).expect("count after discard"),
            1,
            "discarded drafts must not count toward the pending badge"
        );
    }

    #[test]
    fn mutating_missing_draft_returns_not_found() {
        let conn = db::open_in_memory().expect("open db");
        let err = conn
            .mark_discarded("ghost")
            .expect_err("discarding a missing draft must fail");
        assert!(matches!(err, RepoError::DraftNotFound(_)), "got {err:?}");

        let err = conn
            .update_draft("ghost", &macro_payload("x"))
            .expect_err("updating a missing draft must fail");
        assert!(matches!(err, RepoError::DraftNotFound(_)), "got {err:?}");
    }
}
