//! prompt-hub MCP server (M-X.2).
//!
//! A stdio JSON-RPC server spawned by Claude Code (plan §3.1). It opens the
//! shared database read+write but ONLY writes the drafts staging table; the
//! Tauri app owns migrations (R1) so this binary never migrates — it refuses to
//! start unless the on-disk schema already matches. Compile-time write
//! isolation (no `repo-write` dependency) keeps it off the 7 asset tables.
//!
//! stdout is the JSON-RPC frame channel and MUST stay clean — every diagnostic
//! goes to stderr via tracing.

mod errors;
mod server;
mod tools;

use std::path::{Path, PathBuf};
use std::process::ExitCode;

use rmcp::{transport::stdio, ServiceExt};
use tracing::{error, info};

use server::Hub;

fn db_path() -> Option<PathBuf> {
    if let Some(arg) = std::env::args().nth(1) {
        return Some(PathBuf::from(arg));
    }
    std::env::var_os("PROMPT_HUB_DB").map(PathBuf::from)
}

fn init_tracing() {
    // stderr only — stdout belongs to the JSON-RPC transport. ANSI off so logs
    // stay readable when Claude Code captures the child's stderr.
    tracing_subscriber::fmt()
        .with_writer(std::io::stderr)
        .with_ansi(false)
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "prompt_hub_mcp=info".into()),
        )
        .init();
}

#[tokio::main]
async fn main() -> ExitCode {
    init_tracing();

    let Some(path) = db_path() else {
        error!("pass the database path as the first argument or set PROMPT_HUB_DB");
        return ExitCode::FAILURE;
    };

    match serve(&path).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            error!("server exited with error: {e}");
            ExitCode::FAILURE
        }
    }
}

async fn serve(path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let conn = repo_core::db::open_write_checked(path)?;
    info!(
        "opened {} read+write at schema v{}",
        path.display(),
        repo_core::db::latest_version()
    );

    // serve() runs the MCP initialize handshake, then waiting() blocks until the
    // client disconnects or the stream closes.
    let service = Hub::new(conn).serve(stdio()).await?;
    service.waiting().await?;
    Ok(())
}
