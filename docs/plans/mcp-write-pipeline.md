---
type: plan
project: prompt-hub
version: v0.2
created: 2026-05-27
last_modified: 2026-05-27
status: done  # completed 2026-06-03: 14 MCP tools + workspace 4-crate split + drafts UI inbox (M-X.1–X.3) all shipped
author: co  # 🤝 人机共创（CLAUDE §5.2）
related:
  - 01-spec
  - 02-constitution
  - 06-prd
  - 09-tech-stack
  - 07-features
  - 015-expose-mcp-write-pipeline
  - prompt-hub-mvp
description: MCP write pipeline 实施 plan——暴露 stdio MCP server 给 Claude Code 调工具写入 drafts 收件箱，omar 在 Scene 全景区 promote 后归正式资产；4 类资产全开 + 14 tool 双层（5 CRUD + 3 helpers + 6 read）+ Cargo workspace 4 crate 重构（物理拆 repo-core / repo-write）+ drafts 表 migration 0003
---

# Plan: MCP write pipeline

> 4 路调研 + v0.2 二轮 review 合成。决策组合 `a/c/b/c + α + schema_version + 物理拆 repo-core/repo-write + Scene tab + badge + 4 类全开 + 14 tool`。详细论证见 [[015-expose-mcp-write-pipeline]]。v0.2 修订动因见 §13 变更日志。

---

## §0 决策窗口（已锁定 2026-05-27）

| 决策 | 选项 | 来源 |
|---|---|---|
| Q1 主消费者 | (a) Claude Code 本地 stdio | omar |
| Q2 写入范围 | (c) 4 类资产全开（Modifier / Composition / Macro / AlignmentPhrase） | omar |
| Q3 入库策略 | (b) drafts 收件箱 → omar promote → 正式表 | omar |
| Q4 tool 集 | (c) **14 tool 双层**（5 CRUD + 3 helpers + 6 read）— v0.2 补 `get_draft` + `list_modifiers` + `list_compositions` 修复 read API 不对称 | omar (v0.1) + A 路 challenge (v0.2) |
| G1 staging 形态 | (α) 物理 drafts 表（非 label 模式） | omar |
| G4 schema versioning | drafts.schema_version + payload 内 schema_version | D 路 codex |
| G5 边界隔离 | **物理拆 `crates/repo-core` + `crates/repo-write` 两 sub-crate**（v0.2 修订：原 v0.1 "同 crate 三层 trait" 是伪编译期隔离） | B + D 路 (v0.1) + A 路 challenge (v0.2) |
| G6 UI 形态 | Scene 全景区 "📥 草稿" tab + 主形态顶部 badge | B 路 |
| Q-migration | forward-only（不写 down migration） | omar |
| Q-GC | 首版不做 expire / GC 策略 | omar |

---

## §1 一句话定位

让 Claude Code（本地）通过 MCP stdio 调工具，把对话里产生的提示词资产写入 prompt-hub 的 **drafts staging 区**；omar 在 Scene 全景区 "📥 草稿" tab 里 promote → 归入正式资产表（4 类）。

---

## §2 范围

### ✅ 包含

- Cargo workspace **4 crate** 物理重构（`repo-core` rlib + `repo-write` rlib + `prompt-hub` bin + `prompt-hub-mcp` bin）
- drafts 表 + migration 0003（4 类 target_type）
- `prompt-hub-mcp` 独立 binary（`rmcp` 1.7 + stdio + tracing→stderr）
- **14 MCP tool**（5 CRUD + 3 helpers + 6 read）
- `DraftRepo` + `ReadOnlyAssetRepo`（在 `repo-core`）/ `AssetRepo` + `promote_draft`（在 `repo-write`，**MCP crate Cargo.toml 不依赖**，编译器直接红线）
- Scene 全景区 "📥 草稿" tab + 主形态顶部 badge
- promote / edit / discard IPC（Tauri bin 独占）
- ADR-015 + 涟漪（spec / constitution / prd / product-spec / design-spec / features / tech-stack）

### ❌ 不包含（明确排除）

- HTTP / SSE / Streamable HTTP transport（仅 stdio）
- 远程 MCP / claude.ai cloud 接入（需另开 ADR-016）
- macOS 之外平台
- draft expire / GC 任务（M-X.4 之后再议）
- Down migration（forward-only）

---

## §3 架构

### 3.1 进程模型

```
┌─────────────────────────────────────────────────────────┐
│  Claude Code（macOS 本地）                                │
└────────────────────┬────────────────────────────────────┘
                     │ stdio JSON-RPC (rmcp 1.7)
                     │ spawn: `prompt-hub-mcp`（长驻子进程）
┌────────────────────▼────────────────────────────────────┐
│  prompt-hub-mcp（独立 binary）                            │
│  • 14 tool（5 CRUD + 3 helpers + 6 read）                │
│  • tracing → stderr（stdout 是 RPC 通道，禁污染）          │
└────────────────────┬────────────────────────────────────┘
                     │ Cargo.toml: depend on repo-core ONLY
                     │ ⚠️ repo-write 符号在依赖图外，编译器不可见
┌────────────────────▼────────────────────────────────────┐
│  SQLite（WAL + busy_timeout=5000）                       │
│  ┌─────────────────────────────┐  ┌───────────────────┐ │
│  │ 正式资产 7 表（MCP 视角只读） │  │ drafts 表（新）   │ │
│  │  phases / alignment_phrases │  │  4 类 target_type │ │
│  │  macros / scenes /           │  │  schema_version   │ │
│  │  compositions / modifiers /  │  │  provenance JSON  │ │
│  │  usage_records               │  │                   │ │
│  └─────────────────────────────┘  └───────────────────┘ │
└────────────────────▲────────────────────────────────────┘
                     │ Cargo.toml: depend on repo-core + repo-write
                     │ promote = AssetRepo + DraftRepo 跨表事务
┌────────────────────┴────────────────────────────────────┐
│  Tauri 主 app（⌥Space 唤起，按需）                         │
│  • 现有 5 模块 + Scene 草稿 tab + 顶部 badge              │
│  • promote / edit / discard IPC（不暴露给 MCP）           │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Workspace 布局（v0.2 修订：4 crate）

```
prompt-hub/
  Cargo.toml                       # workspace manifest, resolver = "2"
  crates/
    repo-core/                     # rlib，零 Tauri 依赖；MCP 可依赖
      Cargo.toml
      src/
        lib.rs
        db.rs                      # SQLite 连接 + busy_timeout=5000 + open_read_only / open_and_migrate 拆分
        models.rs                  # 资产 struct + DraftPayload enum + Provenance
        error.rs
        repo.rs                    # 兼容自由函数 + DraftRepo trait blanket impl
        trait_draft.rs             # DraftRepo trait（drafts CRUD）
        trait_asset_ro.rs          # ReadOnlyAssetRepo trait（4 类资产只读）
      migrations/                  # 全部 SQL migration（include_str!）
        0001_initial.sql / 0002_seed.sql / 0003_drafts.sql

    repo-write/                    # rlib，仅 prompt-hub bin 依赖；MCP 不依赖
      Cargo.toml                   # depend on repo-core
      src/
        lib.rs
        trait_asset.rs             # AssetRepo trait（4 类资产 CRUD）
        promote.rs                 # promote_draft 跨表事务实现

    prompt-hub/                    # bin: Tauri 主 app
      Cargo.toml                   # depend on repo-core + repo-write
      src/
        main.rs / lib.rs / commands.rs / macos.rs / bench.rs
      tauri.conf.json

    prompt-hub-mcp/                # bin: MCP server
      Cargo.toml                   # depend on repo-core ONLY（编译期硬隔离）
      src/
        main.rs                    # rmcp server entry + tracing → stderr
        tools/
          create_draft.rs / get_draft.rs / list_drafts.rs / update_draft.rs / delete_draft.rs
          bootstrap_from_markdown.rs / save_conversation_as_macro.rs / import_json.rs
          list_phases.rs / list_alignment_phrases.rs / list_macros.rs / list_modifiers.rs / list_compositions.rs / list_scenes.rs
        errors.rs                  # AI 友好错误响应（what + why + suggested next tool）
      tests/
        trybuild_negative.rs       # compile_fail: 试图 import repo_write::AssetRepo 必须编译失败
```

### 3.3 Crate 边界（**物理隔离 = Cargo 依赖图**）

v0.2 修订：原 v0.1 描述"同 crate 三层 trait + 编译期隔离"实际上做不到（pub(crate) 跨 crate 不可见 / feature unification / sealed trait 只防 impl 不防 import）。**真正的编译期隔离 = Cargo 依赖图就是边界**：

| Crate | 依赖 | 可见 trait / 函数 |
|---|---|---|
| `repo-core` | rusqlite / serde | `DraftRepo` / `ReadOnlyAssetRepo` / 自由函数 / 模型 / migration |
| `repo-write` | repo-core | `AssetRepo` / `promote_draft` 跨表事务 |
| `prompt-hub` (bin) | repo-core + repo-write + tauri | 全部 |
| `prompt-hub-mcp` (bin) | **repo-core ONLY** | 只有 DraftRepo + ReadOnlyAssetRepo |

`prompt-hub-mcp/Cargo.toml` 中没有 `repo-write` 的 dependency 行 —— **AssetRepo 这个符号根本不在依赖图里，编译器直接 "unresolved import" 红线**，不是"约定不要 import"。

加 `tests/trybuild_negative.rs` 用 `compile_fail!` 验证 `use repo_write::AssetRepo` 真编译失败（trybuild crate 跑 cargo build 期望失败）。

Clippy lint 加 `disallowed-types`：`prompt-hub-mcp` crate 禁 import `anthropic::*` / `openai::*`（[[02-constitution#D1]] 加固）。

---

## §4 数据模型（migration 0003）

### 4.1 drafts 表

```sql
-- migrations/0003_drafts.sql
CREATE TABLE drafts (
  id              TEXT PRIMARY KEY,
  target_type     TEXT NOT NULL CHECK (target_type IN
                  ('modifier','composition','macro','alignment_phrase')),
  schema_version  INTEGER NOT NULL,
  payload_json    TEXT NOT NULL,
  payload_hash    TEXT NOT NULL,           -- SHA-256(payload_json)，v0.2 加固防重复批量导入
  provenance      TEXT NOT NULL,           -- JSON
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','discarded')),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE INDEX idx_drafts_status_created
  ON drafts(status, created_at DESC);
CREATE INDEX idx_drafts_target_type
  ON drafts(target_type);
CREATE UNIQUE INDEX idx_drafts_hash_pending
  ON drafts(payload_hash)
  WHERE status = 'pending';  -- 仅 pending 去重；discarded 历史保留

-- 注意：forward-only，无 DROP TABLE。
-- 如未来废弃 drafts 表需开新 migration 0004，并在 ADR-015 superseded 链中记录。
```

### 4.2 DraftPayload enum（Rust）

```rust
// crates/repo/src/models.rs（示意）

#[derive(Serialize, Deserialize)]
#[serde(tag = "target_type", deny_unknown_fields)]
pub enum DraftPayload {
    #[serde(rename = "modifier")]
    Modifier {
        schema_version: u32,
        name: String,
        content: String,
        phase_id: String,
        scene_id: Option<String>,
    },
    #[serde(rename = "composition")]
    Composition {
        schema_version: u32,
        name: String,
        modifier_ids: Vec<String>,
        phase_id: String,
        scene_id: Option<String>,
    },
    #[serde(rename = "macro")]
    Macro {
        schema_version: u32,
        name: String,
        content: String,
        phase_id: String,
        scene_id: Option<String>,
    },
    #[serde(rename = "alignment_phrase")]
    AlignmentPhrase {
        schema_version: u32,
        name: String,
        content: String,
        phase_id: String,         // [[02-constitution#B2]] 强约束
        is_default: bool,
    },
}

#[derive(Serialize, Deserialize)]
pub struct Provenance {
    pub source_app: String,           // "Claude Code"
    pub conversation_ref: String,     // hash / id
    pub tool_name: String,            // "create_draft" / "save_conversation_as_macro" / ...
    pub model_hint: Option<String>,   // "claude-opus-4-7"
    pub confidence: Option<f32>,
}
```

### 4.3 promote 路径（type-safe + 跨表事务）

```
drafts row
  → serde_json::from_str::<DraftPayload>(payload_json)?    // 再次校验，防 schema 漂移
  → match payload (4 variants)
  → tx.begin()
      → AssetRepo::insert_modifier / insert_macro / insert_composition / insert_alignment_phrase
      → DraftRepo::mark_discarded(id) 或 DraftRepo::delete(id)
  → tx.commit()
```

`#[serde(deny_unknown_fields)]` + promote 时再次 validate，防 schema 漂移残留。

---

## §5 MCP tool 集（首版 14 个）

### 5.1 Write — Draft CRUD（5 个）

| Tool | 入参 | 出参 | 说明 |
|---|---|---|---|
| `create_draft` | target_type, payload, provenance | draft_id | 唯一原子写入入口 |
| `list_drafts` | status?, target_type?, limit? | [{id, target_type, name, preview, provenance.tool_name, created_at}] | **只返 metadata + preview**，避免 100 条 draft token 爆 |
| `get_draft` | id | { full payload + provenance + status + timestamps } | v0.2 新增（A 路 challenge 发现）—— AI 在 list 后看完整 payload / 隔天 update 前必读 |
| `update_draft` | id, payload | ok | AI 修订未 promote 的 draft |
| `delete_draft` | id | ok | AI 撤回 draft（→ status='discarded'） |

### 5.2 Write — Helpers（3 个，业务级语义）

| Tool | 入参 | 出参 | 说明 |
|---|---|---|---|
| `bootstrap_from_markdown` | markdown_content | [draft_id] | 解析 markdown → 拆多个 draft，按 heading 推断 target_type |
| `save_conversation_as_macro` | transcript, phase_id, name? | draft_id | 对话片段 → Macro draft（**最高频路径**） |
| `import_json` | json_array | { created: N, errors: [...] } | 批量导入；⚠️ 见风险登记 R6 |

**⚠️ `import_json` 风险加固**（D 路 v0.1 + A 路 v0.2 challenge）：

- 单 batch ≤ 100 条
- 单 payload ≤ 64KB
- **整批 request 总 size ≤ 5MB**（v0.2 新增：防超大 JSON 先被反序列化爆内存）
- 全失败回滚（事务）
- provenance.tool_name 必标 `bulk_import`，便于事后审计
- **payload SHA-256 hash 去重**（v0.2 新增）：drafts 表加 `payload_hash` 列；import 时若 hash 已存在则 skip + 错误响应给出现有 draft_id
- **disk / DB size guard**（v0.2 新增）：import 前 `PRAGMA page_count * page_size` 查 DB 大小，超过 250MB 拒绝写入并返回错误 "DB approaching size limit, please promote or discard pending drafts first"
- **bulk_import 速率配额**（v0.2 新增）：每小时 ≤ 5 次 `import_json` 调用，本地内存计数（进程重启重置；不持久化）

### 5.3 Read — 给 AI 参考避免重复（6 个，v0.2 修复 4 类资产 read 不对称）

| Tool | 入参 | 出参 | 说明 |
|---|---|---|---|
| `list_phases` | — | [{id, name, order}] | AI 选 phase_id 必读 |
| `list_alignment_phrases` | phase_id? | [{id, name, content, phase_id}] | 协议层只读 |
| `list_modifiers` | phase_id?, scene_id? | [{id, name, content_preview, phase_id, scene_id}] | **v0.2 新增**（A 路 challenge 发现：原 v0.1 缺失，AI 写 Modifier 时看不到现有同类强迫重复入库） |
| `list_compositions` | phase_id?, scene_id? | [{id, name, modifier_ids, phase_id, scene_id}] | **v0.2 新增**（同上） |
| `list_macros` | phase_id?, scene_id? | [{id, name, content_preview, phase_id, scene_id}] | AI 避免重复入库 |
| `list_scenes` | — | [{id, name}] | AI 选 scene_id |

### 5.4 错误响应规范（C 路调研对标）

```json
{
  "isError": true,
  "content": [{
    "type": "text",
    "text": "phase_id 'phase-bogus' not found. Use list_phases() to see available phases, then retry with a valid id."
  }]
}
```

- 必含 **what + why + suggested next tool**
- 不走 JSON-RPC error 通道（client 会吞掉，LLM 读不到）
- 仿 cyanheads/obsidian-mcp-server 的 `file_exists` 错误模式

---

## §6 UI 扩展

### 6.1 Scene 全景区 "📥 草稿 (N)" tab

- **位置**：Scene 全景区 tab 列尾
- **卡片元素**：
  - target_type icon（4 种）+ name
  - content preview（≤ 100 字）
  - provenance.tool_name + model_hint（如 "claude-code · claude-opus-4-7"）
  - created_at relative time
  - 操作按钮：✏️ edit / ✅ promote / 🗑️ discard

### 6.2 主形态顶部 badge

- **位置**：搜索区右上（参考 design-spec §12 chrome icon 区）
- **触发**：仅 N>0 时显示
- **形态**：纯文本 "📥 N 条待审"（无图标动画，避免 distraction）
- **点击**：跳 Scene 全景区草稿 tab

### 6.3 C1 性能预算守护

- badge count 查询：`SELECT COUNT(*) FROM drafts WHERE status='pending'`
- prepared statement + 索引保证 ≤ 1ms
- bench 扩 `bench/hotkey-wake.bench.mjs`，加 P95 ≤ 200ms assert
- 若发现 badge 破预算 → 降级为 lazy load（Scene tab 打开时再查）

---

## §7 IPC（Tauri 主 app 新增）

只在 `prompt-hub` bin 实现，**不暴露给 MCP**：

| IPC | 入参 | 用途 |
|---|---|---|
| `list_drafts` | status?, target_type?, limit? | UI 读 |
| `count_pending_drafts` | — | badge 读 |
| `promote_draft` | id, override_payload? | 跨表事务，AssetRepo + DraftRepo |
| `update_draft` | id, payload | UI 编辑 |
| `discard_draft` | id | UI discard |

---

## §8 5 Milestone 拆分

| Milestone | 内容 | 工作量 |
|---|---|---|
| **M-X.0 决策落盘** | ADR-015 Accepted / spec / constitution reaffirm / prd / product-spec / design-spec / features / tech-stack 涟漪 / MANIFEST 占位补齐 | S（半天） |
| **M-X.1 数据层 + workspace 重构** | cargo workspace 拆 **4 crate**（repo-core / repo-write / prompt-hub / prompt-hub-mcp）/ migrations/ 迁入 repo-core / `open_read_only` + `open_and_migrate` 拆分 / DraftPayload 4 variant + Provenance + payload_hash / `DraftRepo` + `ReadOnlyAssetRepo`（repo-core）/ `AssetRepo` + `promote_draft`（repo-write）/ migration 0003 / busy_timeout=5000 / migration owner（Tauri 主） + MCP server 启动 check user_version / cargo test ≥ 8 case + trybuild compile_fail（MCP crate 试图 import `repo_write::AssetRepo` 必须编译失败）/ 12 旧测试原地通过 | **L（3-4 天）** |
| **M-X.2 MCP server 骨架** | `prompt-hub-mcp` bin / `rmcp = "=1.7"` stdio / `tracing_subscriber → stderr` / **14 tool** 完整实现（含 get_draft / list_modifiers / list_compositions）/ AI 友好错误响应 / import_json 6 条加固 / cargo test 集成（spawn 进程 + JSON-RPC 端到端） | **L（3-4 天）** |
| **M-X.3 UI 收件箱** | Scene tab "📥 草稿" / 顶部 badge / promote / edit / discard IPC + UI / Vitest 集成 / bench 守 200ms | M（2-3 天） |
| **M-X.4 验证 + 文档** | `claude mcp add` 端到端 dogfood / HANDOFF / CLAUDE.md §7 / features status → done | S（半天） |

**总工作量**：S + L + L + M + S ≈ **9-13 天**

---

## §9 验收标准

### M-X.1 数据层完成

- `cargo test` 全过 + `cargo clippy -D warnings` 0 警告
- migration 0003 跑通（dev 环境）
- `repo` crate 独立 cargo build 通过
- **三 trait 编译期边界验证**：写一个故意试图在 `prompt-hub-mcp` 里 import `AssetRepo` 的 negative test 文件（compile_fail doctest 或 trybuild）

### M-X.2 MCP server 完成

- `claude mcp add --transport stdio prompt-hub -- /absolute/path/to/prompt-hub-mcp` 接入成功
- Claude Code 调用 14 tool 全部端到端 work
- **错误响应被 LLM 读懂**：手测——故意传 bogus phase_id，看 Claude 是否调 `list_phases()` 自纠

### M-X.3 UI 完成

- Scene 草稿 tab 渲染 ≥ 100 条 draft 不卡（FPS ≥ 30）
- **promote 跨表事务 atomic**：中断测试——promote 时 kill process，verify drafts 表无半完成状态
- 唤起 P95 ≤ 200ms（bench 报告）

### 整体端到端

omar 在 Claude Code 说"把刚才这段提示词存进 prompt-hub"
→ Claude 调 `create_draft` 或 `save_conversation_as_macro`
→ omar ⌥Space 唤起 → 顶部看到 "📥 N 条待审"
→ 点击跳 Scene 草稿 tab → 看 draft 卡片 → promote
→ Macro 出现在 MacroGrid → ⌥Space 关闭 → 重启后仍在

---

## §10 风险登记

| # | 风险 | 严重度 | 缓解 |
|---|---|---|---|
| R1 | SQLite migration race（两进程 + 0003 升级时序） | **High** | Tauri 主 app 独占 migration ownership；MCP server 启动时 `PRAGMA user_version` 不兼容则拒绝启动并打印 "请先开 prompt-hub 主 app 升级 DB" 到 stderr |
| R2 | stdout 污染 → Claude Code 静默断连 | **High** | `tracing_subscriber::fmt().with_writer(io::stderr).with_ansi(false).init()`；clippy lint 禁 `println!` / `dbg!` / 默认 logger |
| R3 | rmcp 1.x API 变化（新 major） | Med | 锁 `rmcp = "=1.7"` + bump 走 ADR（[[CLAUDE#§6]] 第 7 项） |
| R4 | draft schema 漂移 | Med | drafts.schema_version + payload 内 schema_version + serde `deny_unknown_fields`；promote 时按版本路由反序列化 |
| R5 | C1 性能预算被 badge 破坏 | Low | badge query prepared stmt + 索引；bench 守底；超预算降级为 lazy load |
| R6 | `import_json` batch DoS / 垃圾 | Med | 单 batch ≤ 100，单 payload ≤ 64KB，事务回滚，provenance 标 `bulk_import` 便于事后审计 |
| R7 | AlignmentPhrase 协议层污染（[[02-constitution#B2]] 敏感） | Med | drafts.target_type='alignment_phrase' 的 promote UI 必须显式选 phase_id + 二次确认；MCP 写入时 phase_id 必填（payload schema enforce） |
| R8 | 4 类 promote 路径都要 type-safe（4 倍工作量 vs 单类） | Med | match enum 集中在一个 `promote()` 函数，重构成本可控 |
| R9 | drafts 表无 GC 长期堆积 | **Med**（v0.2 升级，A 路 challenge）| **破裂点阈值**：pending > 500 → Scene 草稿 tab 渲染 / promote 操作 UI 退化；pending > 10k 或 DB > 250MB → 必须立即加 archive/GC；按 50 条/天约 6-7 个月触达，若 `import_json` 被循环调用几天就到 GB 级。**触发动作**：pending > 500 时主形态 badge 改红警示；DB > 250MB 时 `import_json` / `create_draft` 拒绝写入。GC 任务本身首版仍不做（omar 决定），但**阈值告警 + 写入熔断**纳入 M-X.4 |
| R10 | MCP server 进程意外死亡 → Claude Code 看到 connection lost | Low | rmcp 自身有重连；记录 `last_exit_code` 到 stderr log；如频繁退出列入 M-X.4 加固 |

---

## §11 方法论 §7 八步 checkpoint

| 步骤 | 影响 |
|---|---|
| 1. 锁定 diff | 4 路调研 + omar 拍板 a/c/b/c + α + 5 open question |
| 2. 影响半径 | spec §8 / constitution（reaffirm 反向 AI 写入边界，不新增铁律——C 路 Check 4 确认 5 条铁律完全兼容）/ prd（add drafts layer + 5 IPC + 14 MCP tool）/ product-spec（草稿 tab + badge）/ design-spec（badge 视觉规范）/ features（新区 + 14 sub-feature）/ tech-stack（add `rmcp` 1.7）/ ADR-015 |
| 3. 上游一致性 | constitution D1 "不内嵌 LLM SDK 生成话术" 边界 reaffirm（反向：LLM 调工具入库不违反此条），不新增铁律 |
| 4. bump 版本 | spec v_+0.1 / prd v_+0.1 / product-spec v0.7 / design-spec v0.8 / features v0.3 / tech-stack v1.2 |
| 5. 涟漪更新 | 7 文档按 milestone 拆，M-X.0 期间集中执行 |
| 6. features 回写 | 加 "MCP write pipeline" 章节 + 14 sub-feature 行（5 CRUD + 3 helpers + 6 read） |
| 7. ADR-015 | 单开（不和 008/014 链） |
| 8. AI 层同步 | CLAUDE.md §7 当前状态指针 + HANDOFF 状态刷新 |

---

## §12 Evidence references

- **A 路调研**（Rust MCP SDK 生态）：[`rmcp` 1.7](https://crates.io/crates/rmcp) / [Roblox studio MCP server](https://github.com/Roblox/studio-rust-mcp-server) / [systemprompt.io Rust MCP 教程](https://systemprompt.io/guides/build-mcp-server-rust) / [MCP 官方 build-server doc](https://modelcontextprotocol.io/docs/develop/build-server)
- **B 路调研**（架构 review）：cargo workspace + 3 trait 隔离方案 / rusqlite `busy_timeout` pitfall / Scene tab + badge UX 论证
- **C 路调研**（业界对标）：[Langfuse MCP](https://langfuse.com/docs/prompt-management/features/mcp-server) / PromptLayer / PromptHub / [cyanheads/obsidian-mcp-server](https://github.com/cyanheads/obsidian-mcp-server) / [MarkusPfundstein/mcp-obsidian](https://github.com/MarkusPfundstein/mcp-obsidian) / [github/github-mcp-server](https://github.com/github/github-mcp-server) / [sparesparrow/mcp-prompts](https://github.com/sparesparrow/mcp-prompts) / [Alpic: MCP error responses](https://alpic.ai/blog/better-mcp-tool-call-error-responses-ai-recover-gracefully)
- **D 路 codex consult**：PASS-with-notes / 5 项 blind spots / 5 项 over-engineering 警告 / 3 个潜在坑（SQLite lock/migration race · repo 边界泄漏 · payload validation 时机错位）/ Alt-A draft-only / Alt-B JSONL inbox

---

## §13 变更日志

| 日期 | 版本 | 变更 | 触发 |
|---|---|---|---|
| 2026-05-27 | v0.1 | 初版 plan 落盘，等 ADR-015 Accepted 后进 M-X.0 | 4 路调研 + omar 拍板 a/c/b/c + α |
| 2026-05-27 | v0.2 | 4 Blocker 全修：(B1) §3.2/3.3 改物理拆 4 crate（repo-core + repo-write + prompt-hub + prompt-hub-mcp），原 v0.1 "三层 trait 编译期隔离"是伪命题；(B2) tool 集 12 → **14**：加 `get_draft` + `list_modifiers` + `list_compositions`（修复 4 类资产 read 不对称）；(B3) `import_json` 加 4 条加固（payload SHA-256 去重 / disk 250MB guard / request 5MB cap / 每小时 5 次 quota）；(B4) R9 Low → **Med** + 破裂点阈值（pending>500 / DB>250MB） + M-X.4 加阈值告警 + 写入熔断。M-X.1 提纲采纳 B 路 12 步 step-by-step | 3 路二轮 review（A codex challenge / B Plan / C Explore）|
