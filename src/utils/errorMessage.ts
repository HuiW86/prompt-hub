// P1-3 error-feedback pack: single funnel that turns any caught error into a
// user-facing Chinese message. Raw Rust/IPC errors reach the renderer as plain
// strings (AppError/RepoError serialize-to-string), and many are English debug
// forms unfit to show a user. This module:
//   1. console.error's the raw value (keeps triage/debug capability), then
//   2. returns Chinese copy — passthrough for already-Chinese business rejects,
//      a mapped actionable line for known English business rejects, or the
//      caller-supplied fallback for everything else (IO / SQLite / unknown).
//
// Scope note: the only business rejects that reach the frontend today come from
// repo-core::RepoError and the shell's AppError (src-tauri/src/error.rs,
// src-tauri/crates/repo-core/src/error.rs). Every mapping below cites the
// originating Rust variant so the table stays auditable as those errors evolve.

// Extract a comparable string from an unknown caught value. Errors surfaced over
// Tauri IPC arrive as strings; native JS failures arrive as Error instances.
function rawText(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return String(err);
}

// [matcher, message] pairs. A matcher hits when the raw error text contains its
// probe substring (RegExp for the few that need anchoring). Order matters only
// insofar as the first hit wins; the probes are mutually exclusive in practice.
// Each entry names the Rust variant it covers (repo-core RepoError unless noted).
const MAPPINGS: ReadonlyArray<{
  match: (text: string) => boolean;
  message: string;
}> = [
  {
    // RepoError::SceneNotEmpty — "scene `x` is not empty (has phrases or
    // sub-stages) and cannot be deleted"
    match: (t) => t.includes("is not empty") && t.includes("cannot be deleted"),
    message: "该场景仍有子阶段或话术，请先清空后再删除。",
  },
  {
    // RepoError::DefaultAlignmentPhraseProtected — "alignment phrase `x` is its
    // phase default and cannot be deleted"
    match: (t) =>
      t.includes("is its phase default") && t.includes("cannot be deleted"),
    message: "该话术是当前阶段的默认协议，不能删除；请先将其他话术设为默认。",
  },
  {
    // RepoError::PayloadTooLarge — "payload is N bytes, over the M-byte limit"
    match: (t) => t.includes("payload is") && t.includes("over the"),
    message: "内容体积超出上限（64KB），请精简后再保存。",
  },
  {
    // RepoError::ImportSchemaUnsupported — "import schema version `x` is
    // unsupported — this build restores major version N.x backups"
    match: (t) =>
      t.includes("import schema version") && t.includes("unsupported"),
    message: "导入失败：备份文件版本与当前应用不兼容，请使用匹配版本的备份。",
  },
  {
    // RepoError::SchemaVersionMismatch — "db schema version mismatch: found x,
    // expected y — open the prompt-hub main app to migrate the database first"
    match: (t) => t.includes("db schema version mismatch"),
    message: "数据库版本不匹配，请先打开主程序完成数据迁移。",
  },
  {
    // RepoError::DraftNotPending — "draft `x` is not pending (status: y)"
    match: (t) => t.includes("is not pending"),
    message: "该草稿已被处理，无法再次归档或丢弃，请刷新收件箱。",
  },
  {
    // RepoError::DuplicateDraft — "a pending draft with identical payload
    // already exists: x"
    match: (t) => t.includes("identical payload already exists"),
    message: "已存在内容相同的待处理草稿，请勿重复创建。",
  },
  {
    // RepoError::DraftNotFound / TargetNotFound — "... not found ..."
    match: (t) => t.includes("not found"),
    message: "目标不存在，可能已被删除，请刷新后重试。",
  },
  {
    // RepoError::PromoteMissingField / TargetIdRequired — "... requires `field`
    // to be supplied" / "target_id required for target_type `x`"
    match: (t) =>
      (t.includes("requires") && t.includes("to be supplied")) ||
      t.includes("required for target_type"),
    message: "归档所需的信息不完整，请补全后重试。",
  },
];

/**
 * Convert any caught error into a user-facing Chinese message.
 *
 * Always console.error's the raw error first so triage is never lost. Returns,
 * in order: an already-Chinese message passed through untouched; a mapped line
 * for a known English business reject; otherwise the caller's `fallback`.
 */
export function toUserMessage(err: unknown, fallback: string): string {
  console.error(err);

  const text = rawText(err);

  // Whitelist passthrough: any Chinese-bearing message is already user-facing
  // (frontend fallbacks, or a future Chinese Rust string) — surface verbatim.
  if (/[一-鿿]/.test(text)) return text;

  for (const { match, message } of MAPPINGS) {
    if (match(text)) return message;
  }

  // Everything else (IO / SQLite / serde / tauri / lock-poisoned / unknown) is
  // debug noise unfit for a user — use the caller's actionable fallback.
  return fallback;
}
