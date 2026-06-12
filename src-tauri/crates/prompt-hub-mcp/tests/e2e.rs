//! End-to-end: spawn the real `prompt-hub-mcp` binary and drive it as an MCP
//! client over stdio (plan §8 M-X.2 acceptance). This is the only test that
//! exercises the actual JSON-RPC handshake + transport, not just the handlers.

use rmcp::model::CallToolRequestParams;
use rmcp::model::CallToolResult;
use rmcp::service::{RoleClient, RunningService};
use rmcp::transport::TokioChildProcess;
use rmcp::ServiceExt;
use serde_json::{json, Value};
use tokio::process::Command;

/// Create a migrated database the spawned server can open at the latest schema.
fn migrated_db() -> (tempfile::TempDir, std::path::PathBuf) {
    let dir = tempfile::tempdir().expect("tempdir");
    let path = dir.path().join("prompt-hub.db");
    // Drop the owner connection so the file is fully flushed before the child
    // opens it read+write (the child refuses to migrate — R1).
    let _ = repo_core::db::open_and_migrate(&path).expect("owner migrates");
    (dir, path)
}

/// Spawn the server binary against a freshly migrated DB and complete the MCP
/// initialize handshake, returning the live client service plus the tempdir
/// (kept alive so the DB file isn't deleted out from under the child).
async fn spawn() -> (tempfile::TempDir, RunningService<RoleClient, ()>) {
    let (dir, db) = migrated_db();
    let mut cmd = Command::new(env!("CARGO_BIN_EXE_prompt-hub-mcp"));
    cmd.arg(&db);
    let service =
        ().serve(TokioChildProcess::new(cmd).expect("spawn child"))
            .await
            .expect("mcp initialize handshake");
    (dir, service)
}

/// Call a tool and return the parsed result: `(is_error, inner_json)`. Every
/// tool replies with a single text content block holding a JSON string; we
/// re-parse that inner string so assertions can read structured fields.
async fn call(
    service: &RunningService<RoleClient, ()>,
    name: &'static str,
    args: Value,
) -> (bool, Value) {
    let params = CallToolRequestParams::new(name)
        .with_arguments(args.as_object().expect("args object").clone());
    let result: CallToolResult = service.call_tool(params).await.expect("call tool");
    let is_error = result.is_error.unwrap_or(false);
    let envelope = serde_json::to_value(&result).expect("serialize result");
    let text = envelope["content"][0]["text"]
        .as_str()
        .expect("text content")
        .to_string();
    // Inner text is JSON for success results and a plain sentence for errors.
    let inner = serde_json::from_str(&text).unwrap_or(Value::String(text));
    (is_error, inner)
}

#[tokio::test]
async fn echo_tool_roundtrips_over_stdio() {
    let (_dir, service) = spawn().await;
    let (is_error, inner) = call(&service, "echo", json!({ "msg": "ping" })).await;
    assert!(!is_error);
    let text = inner.as_str().expect("echo text");
    assert!(text.contains("ping"), "echo lost msg: {text}");
    assert!(
        text.contains("db_reachable=true"),
        "db not reachable: {text}"
    );
    service.cancel().await.expect("clean shutdown");
}

#[tokio::test]
async fn server_advertises_all_fourteen_tools() {
    let (_dir, service) = spawn().await;
    let tools = service
        .list_tools(Default::default())
        .await
        .expect("list_tools");
    let listed: Vec<&str> = tools.tools.iter().map(|t| t.name.as_ref()).collect();
    for expected in [
        "create_draft",
        "get_draft",
        "list_drafts",
        "update_draft",
        "delete_draft",
        "bootstrap_from_markdown",
        "save_conversation_as_macro",
        "import_json",
        "list_phases",
        "list_alignment_phrases",
        "list_modifiers",
        "list_compositions",
        "list_macros",
        "list_scenes",
    ] {
        assert!(
            listed.contains(&expected),
            "missing tool {expected}: {listed:?}"
        );
    }
    service.cancel().await.expect("clean shutdown");
}

#[tokio::test]
async fn draft_crud_roundtrips_over_stdio() {
    let (_dir, service) = spawn().await;

    // A real phase_id from the seed, fetched the way the model would.
    let (is_error, phases) = call(&service, "list_phases", json!({})).await;
    assert!(!is_error);
    let phase_id = phases[0]["id"].as_str().expect("seed phase id").to_string();

    // create
    let (is_error, created) = call(
        &service,
        "create_draft",
        json!({
            "payload": {
                "target_type": "macro",
                "name": "Deep Dive",
                "content": "expand this prompt fully",
                "phase_id": phase_id,
            },
            "provenance": { "conversation_ref": "conv-e2e" }
        }),
    )
    .await;
    assert!(!is_error, "create_draft failed: {created}");
    let draft_id = created["draft_id"].as_str().expect("draft_id").to_string();

    // get — full payload round-trips
    let (is_error, got) = call(&service, "get_draft", json!({ "id": draft_id })).await;
    assert!(!is_error);
    assert_eq!(got["payload"]["name"], "Deep Dive");
    assert_eq!(got["provenance"]["toolName"], "create_draft");
    assert_eq!(got["status"], "pending");

    // list — summary projection, no full body
    let (is_error, list) = call(
        &service,
        "list_drafts",
        json!({ "status": "pending", "target_type": "macro" }),
    )
    .await;
    assert!(!is_error);
    assert_eq!(list.as_array().expect("array").len(), 1);
    assert_eq!(list[0]["id"], draft_id.as_str());

    // update
    let (is_error, _) = call(
        &service,
        "update_draft",
        json!({
            "id": draft_id,
            "payload": {
                "target_type": "macro",
                "name": "Deep Dive v2",
                "content": "expand this prompt even more fully",
                "phase_id": phase_id,
            }
        }),
    )
    .await;
    assert!(!is_error);
    let (_, got2) = call(&service, "get_draft", json!({ "id": draft_id })).await;
    assert_eq!(got2["payload"]["name"], "Deep Dive v2");

    // delete (discard)
    let (is_error, _) = call(&service, "delete_draft", json!({ "id": draft_id })).await;
    assert!(!is_error);
    let (_, after) = call(&service, "list_drafts", json!({ "status": "pending" })).await;
    assert_eq!(
        after.as_array().expect("array").len(),
        0,
        "draft still pending"
    );

    service.cancel().await.expect("clean shutdown");
}

#[tokio::test]
async fn create_draft_rejects_oversize_payload() {
    let (_dir, service) = spawn().await;

    let (_, phases) = call(&service, "list_phases", json!({})).await;
    let phase_id = phases[0]["id"].as_str().expect("seed phase id").to_string();

    // 64KB cap (PRD §10.1.1) — content alone exceeds it.
    let (is_error, inner) = call(
        &service,
        "create_draft",
        json!({
            "payload": {
                "target_type": "macro",
                "name": "Huge",
                "content": "x".repeat(64 * 1024 + 1),
                "phase_id": phase_id,
            }
        }),
    )
    .await;
    assert!(is_error, "oversize payload should be a tool error");
    let text = inner.as_str().expect("error text");
    assert!(
        text.contains("limit") && text.contains("Trim"),
        "error should explain the cap and recovery: {text}"
    );

    service.cancel().await.expect("clean shutdown");
}

#[tokio::test]
async fn errors_are_tool_level_so_the_model_can_read_them() {
    let (_dir, service) = spawn().await;

    // A missing draft is a tool-level error (is_error=true with readable text),
    // NOT a JSON-RPC protocol error the client would swallow.
    let (is_error, inner) = call(&service, "get_draft", json!({ "id": "ghost" })).await;
    assert!(is_error, "missing draft should be a tool error");
    let text = inner.as_str().expect("error text");
    assert!(
        text.contains("list_drafts"),
        "error should point at the recovery tool: {text}"
    );

    service.cancel().await.expect("clean shutdown");
}

#[tokio::test]
async fn import_json_batches_and_reports_duplicates() {
    let (_dir, service) = spawn().await;
    let (_, phases) = call(&service, "list_phases", json!({})).await;
    let phase_id = phases[0]["id"].as_str().expect("seed phase id").to_string();

    // Two distinct macros plus a duplicate of the first: 2 created, 1 skipped.
    let (is_error, report) = call(
        &service,
        "import_json",
        json!({
            "items": [
                { "payload": { "target_type": "macro", "name": "A", "content": "alpha", "phase_id": phase_id } },
                { "payload": { "target_type": "macro", "name": "B", "content": "beta", "phase_id": phase_id } },
                { "payload": { "target_type": "macro", "name": "A", "content": "alpha", "phase_id": phase_id } },
            ]
        }),
    )
    .await;
    assert!(!is_error, "import_json failed: {report}");
    assert_eq!(report["created"].as_array().expect("created").len(), 2);
    assert_eq!(report["skipped"].as_array().expect("skipped").len(), 1);
    assert_eq!(report["skipped"][0]["index"], 2);

    service.cancel().await.expect("clean shutdown");
}
