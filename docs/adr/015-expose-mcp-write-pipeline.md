---
type: adr
project: prompt-hub
id: ADR-015
status: Accepted
date: 2026-05-27
description: 暴露 MCP stdio server 给外部 AI 入库——本地 Claude Code 通过 14 tool（5 CRUD + 3 helpers + 6 read）把提示词资产写入 drafts staging 区，omar 跨表事务 promote 后归正式资产；rmcp 1.7 + cargo workspace 4 crate 物理拆分（repo-core + repo-write + prompt-hub + prompt-hub-mcp）保证编译期 Cargo 依赖图就是写入边界
related:
  - 01-spec
  - 02-constitution
  - 06-prd
  - 09-tech-stack
  - 008-enable-macos-private-api
  - mcp-write-pipeline
---

# ADR-015: 暴露 MCP server 给外部 AI 入库

## 1. 标题与日期

- **标题**：暴露 stdio MCP server 给外部 AI（首要消费者：Claude Code 本地 CLI）入库
- **日期**：2026-05-27
- **决策者**：omar
- **影响范围**：
  - 数据层：新增 drafts 表 + migration 0003（含 `payload_hash` 列防重复批量导入）
  - 代码组织：cargo workspace 物理拆 **4 crate**（`repo-core` rlib + `repo-write` rlib + `prompt-hub` bin + `prompt-hub-mcp` bin）
  - 外部接口：新增 MCP stdio JSON-RPC（**14 tool** = 5 CRUD + 3 helpers + 6 read）
  - 设计文档：spec / constitution / prd / product-spec / design-spec / features / tech-stack 全涟漪
  - 关联 plan：[[mcp-write-pipeline]] 实施清单

## 2. Status

`Accepted`（2026-05-27 — omar 审过 v0.1 → 3 路二轮 review（A codex challenge / B Plan / C Explore）→ 4 Blocker 全修后 v0.2 → Accepted）

> 修订路径：v0.1 Proposed → 3 路 review 发现 §3.3 trait 边界伪命题 + tool 集 read 不对称 + import_json 加固漏防线 + R9 严重度低估 → 4 Blocker 全修后 Accepted。详见配套 [[mcp-write-pipeline#§13]] 变更日志 v0.2 行。

## 3. Context

### 触发事件

omar 询问"提示词怎么管理"，发现当前 11 个 Tauri IPC command 全是 read-only + `record_usage`（[[commands.rs]]），没有任何 write 接口。提示词入库的唯一路径是改 `migrations/0002_seed.sql` 然后清掉 DB 让 migration 重跑——dev-only，不是产品路径。

omar 明确诉求：**希望工具暴露标准接口给外部 AI（比如 Claude）帮自己把对话里产生的提示词入库**。

### 业务约束

- [[02-constitution#A2]] 本地优先 — 无服务端，无网络
- [[02-constitution#B1]] 三层资产模型（Modifier / Composition / Macro），禁第 4 层
- [[02-constitution#B2]] 协议层（AlignmentPhrase）与任务层物理分离
- [[02-constitution#D1]] 工具不内嵌 LLM SDK 生成话术（**反向**：LLM 调工具入库不违反此条，需 reaffirm 边界）
- [[01-spec#9]] 9 条哲学之"思考的缓冲" — omar 必须在 AI 写入和正式入库之间保留审视空间

### 技术约束

- [[02-constitution#C1]] 主形态唤起 ≤ 200ms P95 死线
- 现有 SQLite schema 7 表 + WAL 模式 + 全本地 `~/Library/Application Support/.../prompt-hub.db` 路径
- 现有 11 个 read-only IPC（[[commands.rs]]）
- macOS-first（Windows / Linux 未来再说）

### 不决策的代价

- 提示词管理留在 SQL hack 状态，违反 [[01-spec#1.1]] 一句话定位中"提示词资产的展示/调用/**沉淀**"的沉淀层
- omar 想用 Claude Code 帮自己入库的工作流无法形成
- S2 阶段（[[07-features#3.2]]）"未分类草稿识别" + "保存为 Macro 自动提示" 两功能没有底层支撑

## 4. Options Considered

### Option A: MCP server (stdio JSON-RPC) — **选定**

- **描述**：起独立 binary `prompt-hub-mcp`，Claude Code 通过 `claude mcp add --transport stdio` spawn 长驻子进程，调 12 tool 写入 drafts staging 表。
- **优点**：
  - Claude Code / Claude Desktop / Cursor / Continue 原生支持 MCP，AI 工具一等公民
  - `rmcp` 1.7 官方 SDK（crates.io 4.7M 下载 / GitHub 2.7k stars / MCP 官方组织维护）macro 派生 schema 把 boilerplate 砍到最少
  - stdio 是 MCP 官方对 local server 的明确推荐（[modelcontextprotocol.io/docs/develop/build-server](https://modelcontextprotocol.io/docs/develop/build-server)）
  - 跟 [[02-constitution#A2]] 本地优先兼容（本机进程通信，无网络监听）
- **缺点**：
  - 多一个 binary（打包 / 签名 / 安装路径）
  - 两进程并发访问 SQLite，需 WAL + busy_timeout 协调
  - rmcp 1.x 是新 major（0.16 → 1.x migration guide），API 可能再变
- **未来反悔成本**：**中等**。drafts 表是物理隔离 staging，若废弃 MCP 切到别的接口只需迁移 IPC 层；cargo workspace 重构是可复用资产（未来 CLI / 数据导出工具都受益）。

### Option B: CLI 子命令

- **描述**：`prompt-hub add modifier --name "..." --content "..."`，AI 通过 Bash 调用。
- **优点**：
  - 实现轻（cargo subcommand + clap）
  - 不引入新协议
- **缺点**：
  - AI 二等公民（AI 要拼 shell args 而不是用结构化 tool schema）
  - 业界 AI 工具（Claude Code / Cursor / Continue）对 MCP 的支持远超对 CLI 的支持
  - 长期路径，AI 用 Bash 调命令行远不如调 tool 自然，错误处理弱
- **未来反悔成本**：**高**。CLI 命名 / 入参 / 输出格式一旦稳定，迁移到 MCP 要重写 AI 端 prompt + 工作流。

### Option C: HTTP REST API（localhost）

- **描述**：Tauri / 独立进程起 localhost HTTP server（如 :7081），AI 用 curl / fetch 调。
- **优点**：
  - 通用协议，任何 AI / 脚本都能调
  - 已有 web client 工具生态
- **缺点**：
  - 起端口 + 鉴权（token）+ CORS 都要处理
  - 比 stdio 更重：进程间通信 + TCP stack
  - localhost 是 A2 灰色地带（虽然本机但开了 network listener，需 firewall 规则）
  - Claude Code 对 HTTP MCP 支持是次选（spec 2025-03-26 起 SSE deprecated，Streamable HTTP 是替代但只对跨机器场景值得）
- **未来反悔成本**：中。要废弃则关 port + 改文档。

### Option D: 文件协议（watcher 入库）

- **描述**：AI 写 JSON / Markdown 到约定目录，prompt-hub watcher 入库。
- **优点**：
  - 实现极轻（fs watcher）
  - 任何 AI 都能"写文件"
- **缺点**：
  - 没有 schema validation 强约束（容易破坏三层资产铁律）
  - 异步路径，AI 不知道写入是否成功
  - 数据完整性弱（半写入、并发冲突、文件锁）
- **未来反悔成本**：低（删 watcher 即可），但产品路径不严肃。

### Option E: AI 直连 SQLite

- **描述**：AI 直接 `sqlite3 ~/Library/Application\ Support/.../prompt-hub.db "INSERT INTO ..."`。
- **优点**：
  - 实现 0 成本
- **缺点**：
  - 跳过业务层校验（[[02-constitution#B1]] 三层资产 / [[02-constitution#B2]] 协议任务分离 全靠运气）
  - 路径硬编码 / 跨 macOS 版本不稳定
  - **致命**：AI 一旦写错 schema，正式资产表直接污染
- **未来反悔成本**：**极高**。一旦数据污染就是不可逆。

## 5. Decision

**选 Option A：MCP server (stdio) + `rmcp` 1.7 + cargo workspace 4 crate 物理拆分**。

### 核心决策点

1. **协议**：stdio JSON-RPC（不是 SSE / HTTP）
2. **SDK**：`rmcp` 1.7（modelcontextprotocol/rust-sdk 官方）
3. **进程模型**：独立 binary `prompt-hub-mcp`，Claude Code 长驻 spawn（**不是** Tauri 主进程内嵌——主形态 ⌥Space 唤起不常驻）
4. **写入范围**：4 类资产全开（Modifier / Composition / Macro / AlignmentPhrase）
5. **staging 形态**：物理 drafts 表 + 4 类 target_type；AI 不能直接动正式资产表 — **保障机制：物理拆 `repo-core` + `repo-write` 两 sub-crate，`prompt-hub-mcp/Cargo.toml` 不依赖 `repo-write`，编译期 Cargo 依赖图直接红线**（v0.2 修订：原 v0.1 "同 crate 三层 trait + pub(crate) / feature gate" 实际做不到编译期隔离）
6. **tool 集**：**14 tool 双层**
   - 5 CRUD：`create_draft` / `list_drafts` / `get_draft` / `update_draft` / `delete_draft`
   - 3 helpers：`bootstrap_from_markdown` / `save_conversation_as_macro` / `import_json`（含 6 条加固：batch ≤100 / payload ≤64KB / request total ≤5MB / 全失败回滚 / SHA-256 hash 去重 / 每小时 ≤5 次 quota）
   - 6 read：`list_phases` / `list_alignment_phrases` / `list_modifiers` / `list_compositions` / `list_macros` / `list_scenes`（v0.2 修复 4 类资产 read 不对称）
7. **promote**：Tauri 主 app 独占（`AssetRepo` + `promote_draft` 在 `repo-write`），**MCP 永远无法触及**（Cargo.toml 不包含 repo-write dependency）

完整实施清单见 [[mcp-write-pipeline]]。

## 6. Consequences

### 正面后果

- omar 在 Claude Code 工作流里说"把这段存进 prompt-hub" → Claude 调 tool → 几秒内 draft 入库 → ⌥Space 唤起 → 一键 promote → 资产沉淀闭环成立
- S2 阶段（[[07-features#3.2]]）"未分类草稿识别" + "保存为 Macro" 两功能直接由 MCP 路径承担
- cargo workspace 重构后，`repo` crate 可独立复用（未来 CLI / 数据导出 / 移动端复用）
- 4 类资产全开 + 14 tool 一次到位，省去后续 minor version bump 工作

### 负面后果 / 新增维护成本

- 多一个 binary 进 macOS 签名流程（与 M0-4 Developer ID 签名同步推进）
- 两进程 SQLite 并发：必须设 `busy_timeout=5000` + migration ownership 协调（Tauri 主 app 独占 migration，MCP server 启动 check `PRAGMA user_version` 不兼容则 exit 2）
- `rmcp` 1.x bump 走 ADR（对齐 [[CLAUDE#§6]] 第 7 项）
- [[02-constitution#D1]] 需 reaffirm "工具不内嵌 LLM SDK" 边界：`prompt-hub-mcp` crate 加 clippy `disallowed-types` 禁 `anthropic::*` / `openai::*`
- M-X.0 落地后需涟漪 7 份设计文档（spec / constitution / prd / product-spec / design-spec / features / tech-stack）
- workspace 拆 4 crate 后，`cargo test` / `cargo clippy` 全部命令要加 `--workspace`，CI 脚本需更新
- `payload_hash` SHA-256 列加进 drafts 表 schema，promote 时也要记录历史 hash 链

### 未来反悔成本

**中等**。组件可拆性：

- **废弃 MCP 改 CLI / HTTP**：`repo` crate 不动，只换 binary 入口；约 1-2 天工作量
- **废弃 drafts staging 改 label 模式**（C 路调研业界共识）：drafts 表迁移到资产表 `*_status` 字段；约 2-3 天 + 11 个现有 read query 改造（[[CLAUDE#§4.3]] 协议-任务分离不受影响）
- **废弃整个写入功能**：drafts 表保留只读，MCP binary 不打包；几小时

**不可逆点**：

- 一旦 omar 通过 MCP 入库 ≥ 50 条 macro 形成工作流惯性，废弃要承担工作流断裂成本
- cargo workspace 重构本身不可逆（但有正面副作用，复用价值高）
- `provenance` 字段一旦记录在历史 draft 上，schema 演化时要保兼容（schema_version 路由）

### 关联 ADR / 后续可能 ADR

- **ADR-015 (本)**：MCP write pipeline 主决策
- **ADR-016 (未来 possible)**：MCP server 远程化（claude.ai cloud 接入）—— 若 omar 需求出现，涉及 [[02-constitution#A2]] 破例
- **ADR-017 (未来 possible)**：drafts → label 模式迁移 —— 若实际使用证明 drafts 表过重
- **ADR-018 (未来 possible)**：MCP server 第二消费者（Cursor / Continue）适配 —— tool naming / capability 差异

### 衍生约束

- 任何 MCP tool 新增 / 改入参 → 等价于 IPC 改 API，需 minor version bump 并在 plan §13 记录
- `DraftPayload` enum 新增 variant → 需 `schema_version` 路由，旧 draft promote 路径保兼容
- drafts 表 schema 改 → 走 [[CLAUDE#§5.1]] 方法论 §7 八步 + 新 migration（forward-only）
- `prompt-hub-mcp/Cargo.toml` 永远不得 depend on `repo-write`（trybuild compile_fail 测试守护此约束）

---

## 反模式检测（[[000-template]] §反模式 self-check）

- [ ] ❌ 写成需求文档而非决策记录 → 本 ADR 5 个 Options 二选一 / 多选一，是真决策
- [ ] ❌ Decision 含糊 → "选 Option A：MCP + rmcp 1.7 + workspace" 一句话能说清
- [ ] ❌ Consequences 没写未来反悔成本 → §6 已含"中等"评级 + 3 种废弃路径
- [ ] ❌ Status 频繁回改 → 本 ADR `Proposed`，待 omar 审后改 `Accepted`，未来若废弃开新 ADR superseded
