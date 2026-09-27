use repo_core::{DraftRepo, ReadOnlyAssetRepo};
use repo_core::models::{DraftPayload, Provenance};
use repo_write::promote::{promote_draft, PromoteOptions};
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let dir = tempfile::tempdir()?;
    let conn = repo_core::db::open_and_migrate(&dir.path().join("probe.db"))?;
    let phase_id = conn.list_phases()?[0].id.clone();
    let payload = DraftPayload::Macro { schema_version: 1, name: "reentry-probe".into(), content: "synthetic".into(), phase_id, scene_id: None };
    let provenance = Provenance { source_app: "local-analysis-probe".into(), conversation_ref: "synthetic".into(), tool_name: "create_draft".into(), model_hint: None, confidence: None };
    let id = conn.create_draft(&payload, &provenance)?;
    let first = promote_draft(&conn, &id, PromoteOptions::default())?;
    assert!(promote_draft(&conn, &id, PromoteOptions::default()).is_err());
    conn.mark_restored(&id)?;
    let second = promote_draft(&conn, &id, PromoteOptions::default())?;
    assert_ne!(first.asset_id, second.asset_id);
    let count:i64 = conn.query_row("SELECT COUNT(*) FROM macros WHERE name='reentry-probe'",[],|r|r.get(0))?;
    assert_eq!(count,2);
    println!("CONFIRMED: immediate repeat promote is rejected; promote -> restore -> promote creates two distinct assets. Not lifetime exactly-once. UI reachability of this sequence was not tested.");
    Ok(())
}
