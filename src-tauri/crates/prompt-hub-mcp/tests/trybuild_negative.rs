//! Compile-time write-isolation guarantee (plan §3.3 / §9).
//!
//! The MCP crate must never be able to reach the write half of the data layer.
//! The fixture under tests/ui/ tries to `use repo_write::AssetRepo`; because
//! repo-write is absent from this crate's dependency graph, it MUST fail to
//! compile. If repo-write ever leaks into Cargo.toml, this test goes green-to-
//! red and the boundary breach is caught.
//!
//! On a rustc upgrade the expected diagnostic may shift; regenerate the
//! committed .stderr with `TRYBUILD=overwrite cargo test -p prompt-hub-mcp`.

#[test]
fn mcp_cannot_import_repo_write() {
    let t = trybuild::TestCases::new();
    t.compile_fail("tests/ui/import_repo_write.rs");
}
