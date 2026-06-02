// This file MUST NOT compile. The MCP crate deliberately omits repo-write from
// its dependency graph (plan §3.3), so the write API is unreachable here. The
// unresolved import below is the compile-time write-isolation guarantee.
use repo_write::AssetRepo;

fn main() {
    let _: Option<&dyn AssetRepo> = None;
}
