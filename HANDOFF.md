---
type: handoff
project: prompt-hub
created: 2026-05-22
updated: 2026-06-03
status: active
audience: [ai]
description: M-X.3 UI 收件箱收口 — 草稿 tab + 待审 badge + 5 Tauri IPC + mid-session schema recheck，提交 8dab945。M-X 阶段（MCP 反向写入全链路）整体 done。验证全绿（pnpm 57/57，cargo 48/48，clippy/fmt clean）。仅做 promote+discard UI（update IPC 备而未接）。Next：ADR-012 Phase 5 肉眼验收（含草稿 tab/badge）+ M0-4 签名。
related:
  - CLAUDE
  - mcp-write-pipeline
  - 06-prd
  - 015-expose-mcp-write-pipeline
---

# Handoff — M-X.3 UI 收件箱（MCP 反向写入闭环）

<!-- /checkpoint at 2026-06-03 -->

## Objective

让外部 AI 经 MCP 写入 drafts，omar 在桌面 UI 显式 review→promote 入正式表。M-X.3 是 M-X 阶段（MCP 反向写入全链路）的最后一环：UI 收件箱。

## Active Plan

`docs/plans/prompt-hub-mvp.md` — M-X 阶段（MCP write pipeline）**整体 done**（数据层 + workspace 隔离 + 14 tool MCP server + UI 收件箱全收口）。

## Completed (本次会话)

- 草稿 tab：`src/components/DraftInbox.tsx` + `.module.css`（promote/discard 卡片 + Modifier 四象限 popover），挂入 `ScenePanel.tsx` 最左 tab（仅 N>0 显示，排空自动回落 Scene 视图）
- 待审 badge：`SearchBar.tsx` muted 纯文本「📥 N 条待审」，点击 `requestDraftsView()` 跳转，`tabIndex=-1` 排除 Tab 循环
- 状态联动：`appStore.ts` 加 `draftsViewRequestId` 单调计数器；`promptStore.ts` 加 `drafts`/`pendingDraftCount` + `refreshDrafts`/`promoteDraft`/`discardDraft`
- 后端 IPC：`commands.rs` 加 list/count/promote/update/discard 5 命令，写命令经 `guard_schema_then` mid-session schema recheck；`repo-core` 加 `count_pending_drafts` free fn
- 文档涟漪：`07-features.md` v0.6（3 支撑能力 + M-X 阶段转 done）+ `CLAUDE.md §7` 状态指针
- 提交 `8dab945`（20 文件，+1018/−73）

## In Progress

- 无（M-X.3 已收口，工作树干净）

## Next Actions

1. ADR-012 Phase 5：`pnpm tauri dev` 6 步肉眼验收（overlay frame / ⌥Space 唤起 / PhaseBar 8 段 / AlignmentPhrases chip flash / MacroGrid Flame / StatusBar ⌘K）**+ 新增草稿 tab / 待审 badge / promote-discard**
2. M0-4 Developer ID 签名 spike
3. M-X.4（P2 defer）：`create_draft` 单写 size-cap

## Risks & Decisions

- UI 仅做 promote+discard，**未做 update/edit 入口**（autonomous 决策，3 个 IPC 已备但 UI 不接，留待需要时）
- 全部验证为自动化测试，**收件箱真实交互尚未肉眼验收**（待 Next Action 1）

## Verify

- `pnpm test`（57/57）· `pnpm lint` · `pnpm exec prettier --check .` · `pnpm build`
- `cargo test --workspace --manifest-path src-tauri/Cargo.toml`（48/48）· `cargo clippy --workspace --all-targets --manifest-path src-tauri/Cargo.toml -- -D warnings`

## Modified Files

- `src/components/{DraftInbox,ScenePanel,SearchBar}.{tsx,module.css}`
- `src/stores/{appStore,promptStore}.ts` · `src/ipc/{index,types}.ts`
- `src-tauri/src/commands.rs` · `src-tauri/crates/repo-core/src/draft_repo.rs`
- `docs/design/07-features.md` · `CLAUDE.md`
