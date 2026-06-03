use rusqlite::Connection;

use repo_core::error::{RepoError, RepoResult};
use repo_core::models::{DraftPayload, DraftStatus, DraftTargetType};
use repo_core::DraftRepo;

use crate::asset_repo::AssetRepo;

/// Result of a successful promote: the id of the freshly-created asset and which
/// table it landed in.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PromoteOutcome {
    pub asset_id: String,
    pub target_type: DraftTargetType,
}

/// Promote-time inputs the UI supplies that aren't carried in the draft payload.
#[derive(Debug, Default)]
pub struct PromoteOptions {
    /// An omar-edited payload to promote instead of the stored draft body.
    pub override_payload: Option<DraftPayload>,
    /// The four-quadrant group (cognition/action/delivery/constraint) for a
    /// Modifier promote. Required for Modifier (modifiers.group_kind is NOT NULL
    /// and the payload can't carry it — decision iii); ignored otherwise.
    pub group_kind: Option<String>,
}

/// Promote a pending draft into a real asset, atomically (PRD §10.2).
///
/// The draft's stored JSON is re-deserialized here as a second validation pass,
/// so a schema drift that slipped past `create_draft` still can't reach a real
/// table. `opts.override_payload` lets the UI promote an omar-edited version
/// without first persisting the edit back to the draft row.
///
/// Insert + draft discard happen in one transaction: a crash mid-promote leaves
/// neither a half-written asset nor a consumed draft.
///
/// Modifier requires `opts.group_kind` (omar classifies at promote time); a
/// Modifier draft without it returns `RepoError::PromoteMissingField`.
pub fn promote_draft(
    conn: &Connection,
    draft_id: &str,
    opts: PromoteOptions,
) -> RepoResult<PromoteOutcome> {
    let draft = conn
        .get_draft(draft_id)?
        .ok_or_else(|| RepoError::DraftNotFound(draft_id.to_string()))?;
    if draft.status != DraftStatus::Pending {
        return Err(RepoError::DraftNotPending {
            id: draft_id.to_string(),
            status: draft.status.as_str().to_string(),
        });
    }

    let payload = opts.override_payload.unwrap_or(draft.payload);

    let tx = conn.unchecked_transaction()?;
    let outcome = match &payload {
        DraftPayload::Composition {
            name,
            modifier_ids,
            phase_id,
            scene_id,
            ..
        } => {
            let asset_id =
                tx.insert_composition(name, modifier_ids, phase_id, scene_id.as_deref())?;
            PromoteOutcome {
                asset_id,
                target_type: DraftTargetType::Composition,
            }
        }
        DraftPayload::AlignmentPhrase {
            name,
            content,
            phase_id,
            is_default,
            ..
        } => {
            let asset_id = tx.insert_alignment_phrase(name, content, phase_id, *is_default)?;
            PromoteOutcome {
                asset_id,
                target_type: DraftTargetType::AlignmentPhrase,
            }
        }
        DraftPayload::Modifier { name, content, .. } => {
            let group_kind =
                opts.group_kind
                    .as_deref()
                    .ok_or_else(|| RepoError::PromoteMissingField {
                        target_type: DraftTargetType::Modifier.as_str().to_string(),
                        field: "group_kind".to_string(),
                    })?;
            let asset_id = tx.insert_modifier(name, content, group_kind)?;
            PromoteOutcome {
                asset_id,
                target_type: DraftTargetType::Modifier,
            }
        }
        DraftPayload::Macro {
            name,
            content,
            scene_id,
            ..
        } => {
            let asset_id = tx.insert_macro(name, content, scene_id.as_deref())?;
            PromoteOutcome {
                asset_id,
                target_type: DraftTargetType::Macro,
            }
        }
    };

    // Consume the draft in the same transaction so the asset and the discard
    // commit together (re-checks status='pending' — atomic against a racing
    // second promote).
    tx.mark_discarded(draft_id)?;
    tx.commit()?;

    Ok(outcome)
}

#[cfg(test)]
mod tests {
    use super::*;
    use repo_core::db;
    use repo_core::models::Provenance;
    use repo_core::ReadOnlyAssetRepo;
    use rusqlite::params;

    fn migrated_conn() -> (tempfile::TempDir, Connection) {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("prompt-hub.db");
        let conn = db::open_and_migrate(&path).expect("migrate");
        (dir, conn)
    }

    fn prov() -> Provenance {
        Provenance {
            source_app: "Claude Code".to_string(),
            conversation_ref: "c1".to_string(),
            tool_name: "create_draft".to_string(),
            model_hint: None,
            confidence: None,
        }
    }

    fn first_phase_id(conn: &Connection) -> String {
        conn.list_phases().expect("phases")[0].id.clone()
    }

    #[test]
    fn promote_composition_inserts_row_and_discards_draft() {
        let (_dir, conn) = migrated_conn();
        let phase_id = first_phase_id(&conn);
        let payload = DraftPayload::Composition {
            schema_version: 1,
            name: "Tight Brief".to_string(),
            modifier_ids: vec!["mod-a".to_string(), "mod-b".to_string()],
            phase_id: phase_id.clone(),
            scene_id: None,
        };
        let draft_id = conn.create_draft(&payload, &prov()).expect("create");

        let outcome = promote_draft(&conn, &draft_id, PromoteOptions::default()).expect("promote");
        assert_eq!(outcome.target_type, DraftTargetType::Composition);

        let comps = conn.list_compositions().expect("list comps");
        assert_eq!(comps.len(), 1);
        assert_eq!(comps[0].id, outcome.asset_id);
        assert_eq!(comps[0].modifier_ids, vec!["mod-a", "mod-b"]);
        assert_eq!(comps[0].phase_id, phase_id);

        // Draft consumed: now discarded, no longer promotable.
        let draft = conn.get_draft(&draft_id).expect("get").expect("present");
        assert_eq!(draft.status, DraftStatus::Discarded);
    }

    #[test]
    fn promote_alignment_phrase_inserts_row() {
        let (_dir, conn) = migrated_conn();
        let phase_id = first_phase_id(&conn);
        let payload = DraftPayload::AlignmentPhrase {
            schema_version: 1,
            name: "Scope Check".to_string(),
            content: "let's lock scope before coding".to_string(),
            phase_id: phase_id.clone(),
            is_default: false,
        };
        let draft_id = conn.create_draft(&payload, &prov()).expect("create");

        let outcome = promote_draft(&conn, &draft_id, PromoteOptions::default()).expect("promote");
        assert_eq!(outcome.target_type, DraftTargetType::AlignmentPhrase);

        let found = conn
            .list_alignment_phrases()
            .expect("list ap")
            .into_iter()
            .any(|a| a.id == outcome.asset_id && a.name == "Scope Check");
        assert!(found, "promoted alignment phrase must be listed");
    }

    #[test]
    fn promote_is_rejected_for_non_pending_draft() {
        let (_dir, conn) = migrated_conn();
        let phase_id = first_phase_id(&conn);
        let payload = DraftPayload::Composition {
            schema_version: 1,
            name: "Once".to_string(),
            modifier_ids: vec![],
            phase_id,
            scene_id: None,
        };
        let draft_id = conn.create_draft(&payload, &prov()).expect("create");
        promote_draft(&conn, &draft_id, PromoteOptions::default()).expect("first promote");

        // Second promote sees a discarded draft and refuses.
        let err =
            promote_draft(&conn, &draft_id, PromoteOptions::default()).expect_err("second promote");
        assert!(
            matches!(err, RepoError::DraftNotPending { .. }),
            "got {err:?}"
        );
        // And no duplicate composition was written.
        assert_eq!(conn.list_compositions().expect("list").len(), 1);
    }

    #[test]
    fn promote_modifier_requires_group_kind() {
        let (_dir, conn) = migrated_conn();
        let phase_id = first_phase_id(&conn);
        let modifier = DraftPayload::Modifier {
            schema_version: 1,
            name: "Concise".to_string(),
            content: "be terse".to_string(),
            phase_id,
            scene_id: None,
        };
        let mid = conn.create_draft(&modifier, &prov()).expect("create mod");

        // No group_kind supplied → refused before any row is written.
        let err = promote_draft(&conn, &mid, PromoteOptions::default())
            .expect_err("modifier without group_kind");
        assert!(
            matches!(
                err,
                RepoError::PromoteMissingField { ref field, .. } if field == "group_kind"
            ),
            "got {err:?}"
        );
        // Draft stays pending; nothing consumed.
        assert_eq!(
            conn.get_draft(&mid).expect("get").expect("present").status,
            DraftStatus::Pending
        );
        assert_eq!(conn.list_modifiers().expect("list").len(), 0);
    }

    #[test]
    fn promote_modifier_inserts_row_with_group_kind() {
        let (_dir, conn) = migrated_conn();
        let phase_id = first_phase_id(&conn);
        let modifier = DraftPayload::Modifier {
            schema_version: 1,
            name: "Concise".to_string(),
            content: "be terse".to_string(),
            phase_id,
            scene_id: None,
        };
        let mid = conn.create_draft(&modifier, &prov()).expect("create mod");

        let outcome = promote_draft(
            &conn,
            &mid,
            PromoteOptions {
                group_kind: Some("delivery".to_string()),
                ..Default::default()
            },
        )
        .expect("promote modifier");
        assert_eq!(outcome.target_type, DraftTargetType::Modifier);

        let mods = conn.list_modifiers().expect("list mods");
        assert_eq!(mods.len(), 1);
        assert_eq!(mods[0].id, outcome.asset_id);
        assert_eq!(mods[0].group_kind, "delivery");
        assert_eq!(
            conn.get_draft(&mid).expect("get").expect("present").status,
            DraftStatus::Discarded
        );
    }

    #[test]
    fn promote_macro_inserts_non_native_row() {
        let (_dir, conn) = migrated_conn();
        let phase_id = first_phase_id(&conn);
        let macro_payload = DraftPayload::Macro {
            schema_version: 1,
            name: "Expand".to_string(),
            content: "expand fully".to_string(),
            phase_id,
            scene_id: None,
        };
        let kid = conn
            .create_draft(&macro_payload, &prov())
            .expect("create macro");

        let outcome = promote_draft(&conn, &kid, PromoteOptions::default()).expect("promote macro");
        assert_eq!(outcome.target_type, DraftTargetType::Macro);

        let found = conn
            .list_macros()
            .expect("list macros")
            .into_iter()
            .find(|m| m.id == outcome.asset_id)
            .expect("promoted macro listed");
        assert_eq!(found.name, "Expand");
        assert!(!found.native);
        assert!(found.expand_from.is_none());
        assert_eq!(
            conn.get_draft(&kid).expect("get").expect("present").status,
            DraftStatus::Discarded
        );
    }

    #[test]
    fn promote_rejects_schema_drifted_payload() {
        let (_dir, conn) = migrated_conn();
        // Hand-write a draft row whose payload JSON is missing required fields
        // (modifier_ids / phase_id), simulating a schema that drifted after the
        // draft was staged. The re-deserialization at promote time must catch it.
        conn.execute(
            "INSERT INTO drafts
                (id, target_type, schema_version, payload_json, payload_hash,
                 provenance, status, created_at, updated_at)
             VALUES ('drift', 'composition', 1,
                     '{\"target_type\":\"composition\",\"schema_version\":1,\"name\":\"x\"}',
                     'deadbeef', '{}', 'pending', '2026-06-01T00:00:00Z', '2026-06-01T00:00:00Z')",
            params![],
        )
        .expect("raw insert");

        let err = promote_draft(&conn, "drift", PromoteOptions::default())
            .expect_err("drift must be rejected");
        assert!(matches!(err, RepoError::Serde(_)), "got {err:?}");
        // No composition leaked from the failed promote.
        assert_eq!(conn.list_compositions().expect("list").len(), 0);
    }

    #[test]
    fn promote_missing_draft_returns_not_found() {
        let (_dir, conn) = migrated_conn();
        let err = promote_draft(&conn, "ghost", PromoteOptions::default()).expect_err("missing");
        assert!(matches!(err, RepoError::DraftNotFound(_)), "got {err:?}");
    }
}
