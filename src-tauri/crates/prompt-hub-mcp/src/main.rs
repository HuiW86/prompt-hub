//! prompt-hub MCP server — skeleton (M-X.1).
//!
//! The full stdio JSON-RPC server with 14 tools lands in M-X.2. For now this
//! binary only proves the read-only boundary: it opens the shared database
//! read-only (never migrates — the Tauri app owns migrations, R1) and reports
//! the schema version. All diagnostics go to stderr; stdout is reserved for the
//! JSON-RPC stream the MCP transport will own in M-X.2.

use std::path::PathBuf;
use std::process::ExitCode;

fn db_path() -> Option<PathBuf> {
    if let Some(arg) = std::env::args().nth(1) {
        return Some(PathBuf::from(arg));
    }
    std::env::var_os("PROMPT_HUB_DB").map(PathBuf::from)
}

fn main() -> ExitCode {
    let Some(path) = db_path() else {
        eprintln!(
            "prompt-hub-mcp: pass the database path as the first argument or set PROMPT_HUB_DB"
        );
        return ExitCode::FAILURE;
    };

    match repo_core::db::open_read_only(&path) {
        Ok(_conn) => {
            eprintln!(
                "prompt-hub-mcp: opened {} read-only at schema v{}",
                path.display(),
                repo_core::db::latest_version()
            );
            eprintln!("prompt-hub-mcp: tool server not yet implemented (M-X.2)");
            ExitCode::SUCCESS
        }
        Err(e) => {
            eprintln!(
                "prompt-hub-mcp: failed to open {} read-only: {e}",
                path.display()
            );
            ExitCode::FAILURE
        }
    }
}
