//! End-to-end backup verification (PRD §6.9 / §7.5). The inline unit tests in
//! `export.rs` / `import.rs` cover row counts, wholesale replace and rollback.
//! This file fills the gaps the real-machine checklist still cared about:
//!   1. the serialized JSON *shape* — `schema_version` value + the deliberate
//!      absence of `usage_records` / `sops` keys (D2),
//!   2. the `usage_records` lifecycle — present in the DB, never exported, wiped
//!      on restore,
//!   3. field-level fidelity across a round-trip with non-seed data — content,
//!      `modifier_ids` JSON and `order_index` survive verbatim, not just counts.

use repo_core::db;
use repo_core::export::export_json;
use repo_write::import_json;
use rusqlite::Connection;
use tempfile::TempDir;

fn migrated_conn() -> (TempDir, Connection) {
    let dir = tempfile::tempdir().expect("tempdir");
    let path = dir.path().join("prompt-hub.db");
    let conn = db::open_and_migrate(&path).expect("migrate");
    (dir, conn)
}

fn count(conn: &Connection, table: &str) -> i64 {
    conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0))
        .expect("count")
}

/// Checklist A: the exported JSON declares schema_version 1.1 and omits the
/// non-portable tables entirely (keys absent, not empty arrays).
#[test]
fn exported_json_shape_matches_data_contract() {
    let (_dir, conn) = migrated_conn();
    let json: serde_json::Value =
        serde_json::from_str(&export_json(&conn).expect("export")).expect("parse");
    let obj = json.as_object().expect("object");

    assert_eq!(obj["schema_version"], "1.1");

    // D2 + SOP-not-shipped: these keys must be ABSENT from the envelope.
    assert!(!obj.contains_key("usage_records"), "usage_records must not export");
    assert!(!obj.contains_key("sops"), "sops must not export");
    assert!(!obj.contains_key("sop_steps"), "sop_steps must not export");

    // The 8 asset tables that DO round-trip.
    for key in [
        "modifiers",
        "macros",
        "scenes",
        "sub_stages",
        "phrases",
        "phases",
        "alignment_phrases",
        "compositions",
    ] {
        assert!(obj[key].is_array(), "missing asset array: {key}");
    }
}

/// Checklist A + C / D2: a usage_record present before backup is never written
/// to the JSON and is wiped by the restore (its phase_id FK would dangle).
#[test]
fn usage_records_are_excluded_then_wiped() {
    let (_dir, conn) = migrated_conn();
    let phase_id: String = conn
        .query_row("SELECT id FROM phases LIMIT 1", [], |r| r.get(0))
        .expect("a seeded phase");
    conn.execute(
        "INSERT INTO usage_records (id, timestamp, target_type, target_id, source, phase_id)
         VALUES ('u1', '2026-06-01T00:00:00Z', 'macro', 'm1', 'macro_area', ?1)",
        [&phase_id],
    )
    .expect("seed usage record");
    assert_eq!(count(&conn, "usage_records"), 1);

    let json = export_json(&conn).expect("export");
    assert!(
        !json.contains("usage_records"),
        "export string must not mention usage_records"
    );

    import_json(&conn, &json).expect("restore");
    assert_eq!(
        count(&conn, "usage_records"),
        0,
        "restore wipes usage_records and does not bring it back"
    );
}

/// Checklist A "各表行数 + 内容一致": exact field values — not just counts —
/// survive a wipe-and-restore round-trip for realistic, non-seed assets.
#[test]
fn round_trip_preserves_field_level_content() {
    let (_dir, conn) = migrated_conn();

    // A modifier with specific content/notes/order, then a composition that
    // references it by id via the modifier_ids JSON array.
    conn.execute(
        "INSERT INTO modifiers (id, name, content, group_kind, usage_count, created_at, notes, deprecated, order_index)
         VALUES ('mod-x', 'Tone: terse', 'Answer in <=3 sentences.', 'cognition', 7, '2026-02-02T00:00:00Z', 'house style', 0, 3)",
        [],
    )
    .expect("insert modifier");
    let phase_id: String = conn
        .query_row("SELECT id FROM phases LIMIT 1", [], |r| r.get(0))
        .expect("a seeded phase");
    conn.execute(
        "INSERT INTO compositions (id, name, modifier_ids, phase_id, usage_count, created_at, deprecated, order_index)
         VALUES ('comp-x', 'Terse review', '[\"mod-x\"]', ?1, 0, '2026-02-03T00:00:00Z', 0, 5)",
        [&phase_id],
    )
    .expect("insert composition");

    let backup = export_json(&conn).expect("export");

    // Mutate after the snapshot, then restore — the backup values must win.
    conn.execute("UPDATE modifiers SET content = 'TAMPERED', order_index = 99 WHERE id = 'mod-x'", [])
        .expect("tamper");

    import_json(&conn, &backup).expect("restore");

    let (content, notes, usage, order, deprecated): (String, Option<String>, i64, i64, i64) = conn
        .query_row(
            "SELECT content, notes, usage_count, order_index, deprecated FROM modifiers WHERE id = 'mod-x'",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
        )
        .expect("modifier restored");
    assert_eq!(content, "Answer in <=3 sentences.", "content restored verbatim");
    assert_eq!(notes.as_deref(), Some("house style"));
    assert_eq!(usage, 7, "usage_count round-trips");
    assert_eq!(order, 3, "order_index restored, not the tampered 99");
    assert_eq!(deprecated, 0);

    let modifier_ids: String = conn
        .query_row("SELECT modifier_ids FROM compositions WHERE id = 'comp-x'", [], |r| r.get(0))
        .expect("composition restored");
    assert_eq!(modifier_ids, "[\"mod-x\"]", "composition->modifier link survives verbatim");
}
