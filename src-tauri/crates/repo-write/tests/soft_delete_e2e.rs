//! ADR-028 P0 end-to-end: delete stopped removing rows and became an in-place
//! `deleted_at` stamp. The inline unit tests in each write module cover the
//! per-module contract (guards, no-op on a second delete, error on an unknown
//! id). This file covers what only shows up when the write side, the read side
//! and the trash are exercised together:
//!
//!   1. the round trip for all seven kinds, asserting the three identity columns
//!      ADR-028 chose Option A to preserve — `id`, `created_at`, `order_index`
//!      (§4 Option B was rejected precisely because it has to rebuild them);
//!   2. that a trashed row leaves the list read while staying in its table;
//!   3. the alignment-phrase restore conflict the rebuilt partial unique index
//!      makes possible;
//!   4. `purge_trash`, the one irreversible action the ADR creates, including
//!      the FK cleanup it has to do because every FK in this schema is bare;
//!   5. `list_trash` ordering and kind mapping;
//!   6. that a reorder over the visible list is unaffected by a hidden neighbour.

use std::thread::sleep;
use std::time::Duration;

use repo_core::models::{RecordUsageInput, UsageSource, UsageTargetType};
use repo_core::{db, repo, AssetKind};
use repo_write::{
    create_alignment_phrase, create_composition, create_macro, create_modifier, create_phrase,
    create_scene, create_sub_stage, delete_alignment_phrase, delete_composition, delete_macro,
    delete_modifier, delete_phrase, delete_scene, delete_sub_stage, purge_trash,
    reorder_modifiers, restore_asset,
};
use rusqlite::{params, Connection};
use tempfile::TempDir;

fn migrated_conn() -> (TempDir, Connection) {
    let dir = tempfile::tempdir().expect("tempdir");
    let path = dir.path().join("prompt-hub.db");
    let conn = db::open_and_migrate(&path).expect("migrate");
    (dir, conn)
}

/// The three columns ADR-028 promises a restore leaves untouched. Read straight
/// out of the table as stored text / integers, so the comparison is byte-level
/// rather than a round-trip through `DateTime` parsing.
#[derive(Debug, PartialEq, Eq)]
struct Identity {
    id: String,
    created_at: Option<String>,
    order_index: i64,
}

fn identity(conn: &Connection, kind: AssetKind, id: &str) -> Identity {
    let table = kind.table();
    // `scenes` and `sub_stages` carry no `created_at` column in this schema, so
    // the projection substitutes NULL and the assertion still runs for them.
    let created = match kind {
        AssetKind::Scene | AssetKind::SubStage => "NULL",
        _ => "created_at",
    };
    conn.query_row(
        &format!("SELECT id, {created} AS created_at, order_index FROM {table} WHERE id = ?1"),
        params![id],
        |row| {
            Ok(Identity {
                id: row.get(0)?,
                created_at: row.get(1)?,
                order_index: row.get(2)?,
            })
        },
    )
    .expect("row must be present in its table")
}

fn deleted_at(conn: &Connection, kind: AssetKind, id: &str) -> Option<String> {
    let table = kind.table();
    conn.query_row(
        &format!("SELECT deleted_at FROM {table} WHERE id = ?1"),
        params![id],
        |row| row.get(0),
    )
    .expect("row must be present in its table")
}

fn create_one(conn: &Connection, kind: AssetKind) -> String {
    match kind {
        AssetKind::Modifier => create_modifier(conn, "改造器", "body", "cognition")
            .expect("modifier")
            .id,
        AssetKind::Macro => create_macro(conn, "宏", "body", None).expect("macro").id,
        AssetKind::AlignmentPhrase => {
            // Non-default on purpose: the phase default is still protected from
            // deletion (D-c), which ADR-028 did not reopen.
            create_alignment_phrase(conn, "phase-diverge", "对齐话术", "body")
                .expect("alignment phrase")
                .id
        }
        AssetKind::Composition => create_composition(conn, "phase-diverge", "组合", &[], None)
            .expect("composition")
            .id,
        AssetKind::Phrase => create_phrase(conn, "scene-research", "话术", "body", None)
            .expect("phrase")
            .id,
        // A fresh, childless scene: `delete_scene` still refuses a scene with
        // live children.
        AssetKind::Scene => create_scene(conn, "场景", None, &[], None).expect("scene").id,
        AssetKind::SubStage => create_sub_stage(conn, "scene-research", "子阶段")
            .expect("sub stage")
            .id,
    }
}

fn delete_one(conn: &Connection, kind: AssetKind, id: &str) {
    let outcome = match kind {
        AssetKind::Modifier => delete_modifier(conn, id),
        AssetKind::Macro => delete_macro(conn, id),
        AssetKind::AlignmentPhrase => delete_alignment_phrase(conn, id),
        AssetKind::Composition => delete_composition(conn, id),
        AssetKind::Phrase => delete_phrase(conn, id),
        AssetKind::Scene => delete_scene(conn, id),
        AssetKind::SubStage => delete_sub_stage(conn, id),
    };
    outcome.unwrap_or_else(|e| panic!("delete {} failed: {e:?}", kind.as_str()));
}

/// Whether the asset shows up in the list read a user actually looks at.
fn is_listed(conn: &Connection, kind: AssetKind, id: &str) -> bool {
    match kind {
        AssetKind::Modifier => repo::list_modifiers(conn)
            .expect("list modifiers")
            .iter()
            .any(|m| m.id == id),
        AssetKind::Macro => repo::list_macros(conn)
            .expect("list macros")
            .iter()
            .any(|m| m.id == id),
        AssetKind::AlignmentPhrase => repo::list_alignment_phrases(conn)
            .expect("list alignment phrases")
            .iter()
            .any(|a| a.id == id),
        AssetKind::Composition => repo::list_compositions(conn)
            .expect("list compositions")
            .iter()
            .any(|c| c.id == id),
        AssetKind::Phrase => repo::list_scenes_with_children(conn)
            .expect("list scenes")
            .iter()
            .any(|s| s.phrases.iter().any(|p| p.id == id)),
        AssetKind::Scene => repo::list_scenes_with_children(conn)
            .expect("list scenes")
            .iter()
            .any(|s| s.scene.id == id),
        AssetKind::SubStage => repo::list_scenes_with_children(conn)
            .expect("list scenes")
            .iter()
            .any(|s| s.sub_stages.iter().any(|ss| ss.id == id)),
    }
}

/// The core claim of ADR-028 §4 Option A: a restore is a single UPDATE, so the
/// row comes back carrying the same id, the same creation timestamp and the same
/// slot in its ordering partition. Option B ("move the row to a trash table")
/// was rejected because it must rebuild all three, so asserting "it came back"
/// alone would not distinguish the two designs.
#[test]
fn restore_returns_every_kind_with_id_created_at_and_order_index_unchanged() {
    for kind in AssetKind::ALL {
        let (_dir, conn) = migrated_conn();
        let id = create_one(&conn, kind);
        assert!(
            is_listed(&conn, kind, &id),
            "{} must be visible before the delete",
            kind.as_str()
        );
        let before = identity(&conn, kind, &id);

        delete_one(&conn, kind, &id);
        assert!(
            !is_listed(&conn, kind, &id),
            "{} must leave its list read once trashed",
            kind.as_str()
        );

        restore_asset(&conn, kind, &id).expect("restore");
        assert!(
            is_listed(&conn, kind, &id),
            "{} must come back into its list read",
            kind.as_str()
        );
        assert_eq!(
            deleted_at(&conn, kind, &id),
            None,
            "{} must be alive again (deleted_at back to NULL)",
            kind.as_str()
        );

        let after = identity(&conn, kind, &id);
        assert_eq!(after.id, before.id, "{} id must survive", kind.as_str());
        assert_eq!(
            after.created_at,
            before.created_at,
            "{} created_at must survive byte-for-byte",
            kind.as_str()
        );
        assert_eq!(
            after.order_index,
            before.order_index,
            "{} order_index must survive — the restore must not append it to the end",
            kind.as_str()
        );
    }
}

/// Hiding, not removing: the list read stops returning the row while the row is
/// still physically in its table with a timestamp on it. This is the whole
/// difference between ADR-028 and the hard delete it replaced.
#[test]
fn a_trashed_row_leaves_the_list_read_but_stays_in_its_table() {
    for kind in AssetKind::ALL {
        let (_dir, conn) = migrated_conn();
        let id = create_one(&conn, kind);

        delete_one(&conn, kind, &id);

        assert!(
            !is_listed(&conn, kind, &id),
            "{} must be hidden from its list read",
            kind.as_str()
        );
        let table = kind.table();
        let rows: i64 = conn
            .query_row(
                &format!("SELECT COUNT(*) FROM {table} WHERE id = ?1"),
                params![id],
                |r| r.get(0),
            )
            .expect("count");
        assert_eq!(rows, 1, "{} row must not be removed", kind.as_str());
        assert!(
            deleted_at(&conn, kind, &id).is_some(),
            "{} must carry a deletion timestamp",
            kind.as_str()
        );
    }
}

/// The conflict the migration's index rebuild creates and `restore_asset` has to
/// absorb. `idx_alignment_phrase_one_default_per_phase` now ignores trashed rows,
/// so a phase can appoint a new default while its old default sits in the trash
/// still carrying `is_default = 1`. Restoring it must demote it, not fail — the
/// user asked for their content back.
///
/// The trashed default is stamped with raw SQL because `delete_alignment_phrase`
/// still refuses to trash a live phase default (D-c, untouched by ADR-028). The
/// state is nonetheless reachable in production: `import_json` writes `is_default`
/// and `deleted_at` verbatim from a bundle (`import.rs::insert_alignment_phrases`).
#[test]
fn restoring_a_trashed_default_alignment_phrase_demotes_it_instead_of_failing() {
    let (_dir, conn) = migrated_conn();

    // ap-diverge-default is the seeded default of phase-diverge.
    conn.execute(
        "UPDATE alignment_phrases SET deleted_at = '2026-09-03T00:00:00+00:00'
         WHERE id = 'ap-diverge-default'",
        [],
    )
    .expect("stamp the default as trashed");

    // The slot is free now, so a second phrase can take the default.
    let successor =
        create_alignment_phrase(&conn, "phase-diverge", "新的默认", "body").expect("create");
    repo_write::set_default_alignment_phrase(&conn, "phase-diverge", &successor.id)
        .expect("appoint a new default while the old one is in the trash");

    restore_asset(&conn, AssetKind::AlignmentPhrase, "ap-diverge-default")
        .expect("restore must succeed rather than report a constraint violation");

    let restored: (Option<String>, i64) = conn
        .query_row(
            "SELECT deleted_at, is_default FROM alignment_phrases WHERE id = 'ap-diverge-default'",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .expect("read restored row");
    assert_eq!(restored.0, None, "restored row must be alive");
    assert_eq!(restored.1, 0, "restored row must come back demoted");

    let successor_flag: i64 = conn
        .query_row(
            "SELECT is_default FROM alignment_phrases WHERE id = ?1",
            params![successor.id],
            |r| r.get(0),
        )
        .expect("read successor");
    assert_eq!(successor_flag, 1, "the appointed default must keep the slot");

    let live_defaults: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM alignment_phrases
             WHERE phase_id = 'phase-diverge' AND is_default = 1 AND deleted_at IS NULL",
            [],
            |r| r.get(0),
        )
        .expect("count defaults");
    assert_eq!(live_defaults, 1, "exactly one live default per phase");

    // And the rebuilt partial unique index still bites: a second live default in
    // the same phase must be rejected by SQLite, not merely by application code.
    let violation = conn.execute(
        "UPDATE alignment_phrases SET is_default = 1 WHERE id = 'ap-diverge-default'",
        [],
    );
    assert!(
        violation.is_err(),
        "the rebuilt unique index must still forbid a second live default"
    );
}

/// `list_trash` is the read half of the trash: every kind, newest deletion first.
#[test]
fn list_trash_reports_every_kind_newest_first_and_is_empty_by_default() {
    let (_dir, conn) = migrated_conn();
    assert!(
        repo_core::list_trash(&conn).expect("list").is_empty(),
        "a fresh database has an empty trash"
    );

    let modifier = create_modifier(&conn, "被删的改造器", "body", "action").expect("modifier");
    let mac = create_macro(&conn, "被删的宏", "body", None).expect("macro");
    let scene = create_scene(&conn, "被删的场景", None, &[], None).expect("scene");

    // Sequenced deletions: the ordering claim is about deletion time, so the
    // three stamps have to be distinguishable.
    delete_modifier(&conn, &modifier.id).expect("delete modifier");
    sleep(Duration::from_millis(5));
    delete_macro(&conn, &mac.id).expect("delete macro");
    sleep(Duration::from_millis(5));
    delete_scene(&conn, &scene.id).expect("delete scene");

    let trash = repo_core::list_trash(&conn).expect("list");
    let seen: Vec<(&str, &str, &str)> = trash
        .iter()
        .map(|e| (e.kind.as_str(), e.id.as_str(), e.label.as_str()))
        .collect();
    assert_eq!(
        seen,
        vec![
            ("scene", scene.id.as_str(), "被删的场景"),
            ("macro", mac.id.as_str(), "被删的宏"),
            ("modifier", modifier.id.as_str(), "被删的改造器"),
        ],
        "newest deletion first, with the right kind string and the asset's name"
    );
    assert!(
        trash[0].deleted_at >= trash[1].deleted_at && trash[1].deleted_at >= trash[2].deleted_at,
        "deleted_at must be non-increasing down the list"
    );

    // A restore takes the entry back out of the trash view.
    restore_asset(&conn, AssetKind::Macro, &mac.id).expect("restore");
    let after = repo_core::list_trash(&conn).expect("list again");
    assert_eq!(after.len(), 2);
    assert!(after.iter().all(|e| e.id != mac.id));
}

/// `purge_trash` is the one irreversible action ADR-028 creates. It has to hard
/// delete the trashed rows, do the FK housekeeping that the soft deletes
/// deliberately skipped (sub-decision 7 moved the sub-stage unbind here), drop
/// the usage records that just lost their target, and touch nothing that is
/// still alive.
#[test]
fn purge_trash_destroys_only_trashed_rows_and_leaves_the_schema_consistent() {
    let (_dir, conn) = migrated_conn();

    // An empty scene that goes to the trash whole.
    let empty_scene = create_scene(&conn, "空场景", None, &[], None).expect("scene");
    delete_scene(&conn, &empty_scene.id).expect("delete empty scene");

    // A live scene whose sub-stage is trashed while a LIVE phrase still points at
    // it — the dangling reference the purge has to neutralise before deleting.
    let host = create_scene(&conn, "宿主场景", None, &[], None).expect("scene");
    let stage = create_sub_stage(&conn, &host.id, "子阶段").expect("sub stage");
    let kept_phrase =
        create_phrase(&conn, &host.id, "留下的话术", "body", Some(&stage.id)).expect("phrase");
    delete_sub_stage(&conn, &stage.id).expect("delete sub stage");

    // One trashed and one live modifier, each with a usage record.
    let doomed = create_modifier(&conn, "将被清空", "body", "cognition").expect("modifier");
    let survivor = create_modifier(&conn, "还活着", "body", "cognition").expect("modifier");
    for id in [&doomed.id, &survivor.id] {
        repo::record_usage(
            &conn,
            RecordUsageInput {
                target_type: UsageTargetType::Modifier,
                target_id: Some(id.clone()),
                source: UsageSource::MacroArea,
                modifier_ids: None,
                sop_id: None,
                sop_step_order: None,
                phase_id: None,
            },
        )
        .expect("record usage");
    }
    // A composition usage carries no target id and can never be orphaned.
    repo::record_usage(
        &conn,
        RecordUsageInput {
            target_type: UsageTargetType::Composition,
            target_id: None,
            source: UsageSource::Composition,
            modifier_ids: Some(vec![survivor.id.clone()]),
            sop_id: None,
            sop_step_order: None,
            phase_id: Some("phase-diverge".to_string()),
        },
    )
    .expect("record composition usage");
    delete_modifier(&conn, &doomed.id).expect("delete modifier");

    let summary = purge_trash(&conn).expect("purge");
    assert_eq!(
        summary.assets, 3,
        "the empty scene, the sub-stage and the trashed modifier"
    );
    assert_eq!(
        summary.usage_records, 1,
        "only the trashed modifier's usage row lost its target"
    );

    // Trashed rows are gone for real.
    for (table, id) in [
        ("scenes", &empty_scene.id),
        ("sub_stages", &stage.id),
        ("modifiers", &doomed.id),
    ] {
        let n: i64 = conn
            .query_row(
                &format!("SELECT COUNT(*) FROM {table} WHERE id = ?1"),
                params![id],
                |r| r.get(0),
            )
            .expect("count");
        assert_eq!(n, 0, "{table} row {id} must be hard-deleted");
    }

    // The live phrase survived and was unbound from the purged sub-stage.
    let bound: Option<String> = conn
        .query_row(
            "SELECT sub_stage_id FROM phrases WHERE id = ?1",
            params![kept_phrase.id],
            |r| r.get(0),
        )
        .expect("read phrase");
    assert_eq!(
        bound, None,
        "a live phrase whose sub-stage was purged must be unbound, not deleted"
    );
    assert!(
        repo::list_scenes_with_children(&conn)
            .expect("list scenes")
            .iter()
            .any(|s| s.scene.id == host.id),
        "the live host scene must be untouched"
    );

    // Usage rows: the orphan is gone, the live target's row and the id-less
    // composition row are not.
    let orphan: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM usage_records WHERE target_id = ?1",
            params![doomed.id],
            |r| r.get(0),
        )
        .expect("count orphan usage");
    assert_eq!(orphan, 0, "usage rows pointing at a purged asset must go");
    let survivor_usage: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM usage_records WHERE target_id = ?1",
            params![survivor.id],
            |r| r.get(0),
        )
        .expect("count survivor usage");
    assert_eq!(survivor_usage, 1, "a live target keeps its usage history");
    let null_target: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM usage_records WHERE target_id IS NULL",
            [],
            |r| r.get(0),
        )
        .expect("count null-target usage");
    assert_eq!(
        null_target, 1,
        "a usage row with no target id cannot be an orphan"
    );

    // Every FK in this schema is bare (no cascade, no SET NULL), so the purge
    // order is the only thing keeping the database consistent. Ask SQLite.
    let mut stmt = conn
        .prepare("PRAGMA foreign_key_check")
        .expect("prepare fk check");
    let violations: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .expect("run fk check")
        .collect::<rusqlite::Result<Vec<_>>>()
        .expect("collect fk check");
    assert!(
        violations.is_empty(),
        "foreign_key_check reported {violations:?}"
    );

    // Purging an empty trash is a harmless no-op.
    let again = purge_trash(&conn).expect("second purge");
    assert_eq!(again.assets, 0);
    assert_eq!(again.usage_records, 0);
}

/// Reordering is driven by the list the renderer can see, which no longer
/// contains trashed rows. Swapping the two visible neighbours around a hidden
/// one must produce exactly that swap, and feeding the hidden id back in must be
/// rejected rather than silently resurrect it into the ordering.
#[test]
fn reorder_over_the_visible_list_skips_a_trashed_neighbour() {
    let (_dir, conn) = migrated_conn();
    let first = create_modifier(&conn, "甲", "body", "delivery").expect("first");
    let hidden = create_modifier(&conn, "乙", "body", "delivery").expect("hidden");
    let last = create_modifier(&conn, "丙", "body", "delivery").expect("last");
    assert_eq!((first.order_index, hidden.order_index, last.order_index), (0, 1, 2));

    delete_modifier(&conn, &hidden.id).expect("delete the middle one");

    let visible = |conn: &Connection| -> Vec<String> {
        repo::list_modifiers(conn)
            .expect("list")
            .into_iter()
            .filter(|m| m.group_kind == "delivery")
            .map(|m| m.id)
            .collect()
    };
    assert_eq!(visible(&conn), vec![first.id.clone(), last.id.clone()]);

    // The user drags 丙 above 甲. The renderer submits only what it showed.
    reorder_modifiers(&conn, "delivery", &[last.id.clone(), first.id.clone()]).expect("reorder");
    assert_eq!(
        visible(&conn),
        vec![last.id.clone(), first.id.clone()],
        "the visible order must be exactly the submitted one — no gap where the trashed row was"
    );

    // The trashed row kept its own slot and did not join the rewrite.
    let hidden_slot: i64 = conn
        .query_row(
            "SELECT order_index FROM modifiers WHERE id = ?1",
            params![hidden.id],
            |r| r.get(0),
        )
        .expect("read hidden slot");
    assert_eq!(hidden_slot, 1, "a trashed row is not part of any reorder");

    // A stale renderer that still holds the trashed id is refused outright.
    let err = reorder_modifiers(
        &conn,
        "delivery",
        &[last.id.clone(), hidden.id.clone(), first.id.clone()],
    )
    .expect_err("a trashed id must not be accepted into an order");
    assert!(
        matches!(err, repo_core::RepoError::TargetNotFound { .. }),
        "got {err:?}"
    );
}
