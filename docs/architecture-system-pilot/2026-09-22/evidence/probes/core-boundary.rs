// Temporary DB only. This binary deliberately has no repo-write dependency.
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let dir = tempfile::tempdir()?;
    let path = dir.path().join("probe.db");
    drop(repo_core::db::open_and_migrate(&path)?);
    let conn = repo_core::db::open_write_checked(&path)?;
    let changed = conn.execute("INSERT INTO modifiers (id,name,content,group_kind,created_at) VALUES ('boundary-probe','probe','synthetic','cognition','2026-09-22T00:00:00Z')", [])?;
    assert_eq!(changed, 1);
    println!("CONFIRMED: repo-core-only consumer can insert an asset through open_write_checked().execute(); dependency isolation is not a table-level permission boundary.");
    Ok(())
}
