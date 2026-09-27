# 来源、命题与证据

所有 Cxx 对应 `ph:CLM-cxx@0.1.0`；confirmed 的范围是表内具体命题，而不是整个需求已经验收。代码基线为 `317106d`，源码符号及 SHA-256 见 [source-index](evidence/source-index.json)，本次读取的文档版本见 [document-versions](evidence/document-versions.json)。

## 来源与证据身份

| ID | 原始材料 | 能证明与不能证明 |
|---|---|---|
| SRC-CODE / E-SOURCE | [源码基线](evidence/baseline.json)、[符号索引](evidence/source-index.json)、[接口声明](evidence/interface-inventory.json) | 当前实现路径和声明；不单独证明运行成功 |
| SRC-DOC / E-DOC | [原设计文档](../../../docs/design)、[HANDOFF](../../../HANDOFF.md)、[版本摘录](evidence/document-versions.json) | 项目约定、历史记录与待办；索引摘要可能滞后 |
| SRC-TEST / E-FE | [Vitest 原始 JSON](evidence/frontend-tests.json)、[执行元数据](evidence/frontend-run.json) | 本机 jsdom/静态门结果；不代表 macOS WebView 真机行为 |
| SRC-TEST / E-RUST | [Cargo 原始日志](evidence/rust-tests.log)、[执行元数据](evidence/rust-run.json) | 仓库测试、临时 SQLite、MCP 子进程通信、trybuild；不覆盖当前 UI 到全部 IPC 的实机链 |
| SRC-PROBE / E-PROBE | [两个反例结果](evidence/probes/results.json)、[可复跑脚本](evidence/probes/run.py)、[隔离实验](evidence/probes/core-boundary.rs)、[状态实验](evidence/probes/draft-reentry.rs) | 局部反例成立；不证明现有 MCP 公开工具可利用旁路，不证明 UI 可达恢复后再次采纳 |
| SRC-PRIOR | [原 HANDOFF 验证摘要](../../../HANDOFF.md) | 既有 2026-09-06 运行声明；本轮未获得全部旧原始产物，不回填成本轮 target pass |

探针在 `tempfile` 数据库中使用合成内容，未访问或修改真实用户资产。运行器生成的 Cargo manifest、lockfile、输出一并留在 evidence/probes；临时工程目录在运行后清理，脚本可重新生成，不应直接重用日志中的临时绝对路径。

## 命题表

| 命题 | 状态与条件 | 原始依据 | 推断限制与核查 |
|---|---|---|---|
| C01：当前由 React/Tauri 宿主和独立 MCP 进程共享本机 SQLite，宿主拥有迁移职责 | confirmed，源码结构 | [宿主](../../../src-tauri/src/lib.rs)、[MCP main](../../../src-tauri/crates/prompt-hub-mcp/src/main.rs)、[db](../../../src-tauri/crates/repo-core/src/db.rs) | 当前用户 MCP 客户端配置未核查；“只有宿主调用迁移”是入口组织约束，不是 core API 不可访问 |
| C02：复制先写剪贴板，再尝试记录，记录失败不撤销复制 | confirmed，源码与本机组件测试 | [useCopy](../../../src/hooks/useCopy.ts)、[recordingSlice](../../../src/stores/prompt/recordingSlice.ts)、[commands record_usage](../../../src-tauri/src/commands.rs)、E-FE | 外部粘贴/发送/AI 接收未知；不能从 usage 反推 |
| C03：当前 MCP 公开路由写草稿，正式采纳在宿主；无 repo-write 依赖不能保证底层资产表不可写 | confirmed，源码、trybuild、临时反例 | [server](../../../src-tauri/crates/prompt-hub-mcp/src/server.rs)、[依赖](../../../src-tauri/crates/prompt-hub-mcp/Cargo.toml)、[negative test](../../../src-tauri/crates/prompt-hub-mcp/tests/trybuild_negative.rs)、E-PROBE | 反例只针对原始可写连接的权限保证；未发现公开任意 SQL 工具，不扩大为远程漏洞结论 |
| C04：采纳插入与 pending→discarded 同事务；立即重复被拒；恢复后可再次产生资产 | confirmed，源函数及临时 SQLite | [promote](../../../src-tauri/crates/repo-write/src/promote.rs)、[DraftRepo](../../../src-tauri/crates/repo-core/src/draft_repo.rs)、E-RUST、E-PROBE | UI 恢复已采纳草稿的可达性 unknown；永久幂等不是已有保证 |
| C05：七类资产原地软删除，恢复处理祖先与默认冲突，永久清空独立 | confirmed，源码和仓库测试 | [soft_delete](../../../src-tauri/crates/repo-write/src/soft_delete.rs)、[trash](../../../src-tauri/crates/repo-write/src/trash.rs)、E-RUST | 不包括已执行外部副作用；七类之外不能套用 |
| C06：宿主危险变更前快照失败会阻断；每日备份失败容忍 | confirmed，源码及宿主/组件测试 | [import_with_backup](../../../src-tauri/src/commands.rs)、[backup](../../../src-tauri/crates/repo-core/src/backup.rs)、[db](../../../src-tauri/crates/repo-core/src/db.rs)、[lib](../../../src-tauri/src/lib.rs)、E-RUST | 不能扩大为直接调用 repo-write import 也自动备份；断电恢复未验 |
| C07：资产包替换并非整库镜像，保留/清空范围和字段缺失/空值各有定义 | confirmed，源码和导入测试 | [export](../../../src-tauri/crates/repo-core/src/export.rs)、[import](../../../src-tauri/crates/repo-write/src/import.rs)、E-RUST | 完整用户库恢复未运行；引用保持仍需按输入校验 |
| C08：IPC gate 验证 62 个名称集合；MCP 源码有15个工具，列表测试仅断言14个业务名存在 | confirmed，静态提取和测试断言 | [IPC gate](../../../src/ipc/ipc-contract.test.ts)、[MCP e2e](../../../src-tauri/crates/prompt-hub-mcp/tests/e2e.rs)、[inventory](evidence/interface-inventory.json)、E-FE/E-RUST | 名称 gate 不检查全部字段；测试名字不能替代精确集合断言；15为源码计数 |
| C09：口令归因依会话、source、时间顺序和当前话术元数据，不评判 AI 效果 | confirmed，源码与测试 | [sessionStore](../../../src/stores/sessionStore.ts)、[summarize_drift_ledger](../../../src-tauri/crates/repo-core/src/repo.rs)、E-FE/E-RUST | 历史无会话记录不参与；不是因果/效果评测；notes 回显沿用待办54 |
| C10：本地数据架构仍有选择启用的更新通道 | confirmed，静态配置/调用路径 | [App](../../../src/App.tsx)、[updaterStore](../../../src/stores/updaterStore.ts)、[Tauri config](../../../src-tauri/tauri.conf.json) | 本轮未访问更新源、下载包或验签；当前线上版本 unknown |
| C11：上述职责可能迁移到其他本地工具 | inferred，契约设计 | C03—C08、[能力对比](capabilities.md) | 依据是事务/生命周期机制可分离；另一解释是领域耦合比预计更强。用新场景陈旧版本、依赖恢复和字段兼容测试核查 |
| C12：当前代码达到全部原生 UI、C1 与发布验收条件 | unknown | [本轮限制](verification.md) | 未执行目标验收；旧 HANDOFF 和本次组件数不能使该命题 confirmed |

## 可失效条件

源代码、schema、权限边界、UI 类型门控、字段兼容或依赖发生变化时，检查 C01—C10 及对应能力版本。共享候选改变不自动修改原项目；若要采用新保证，另按原项目变更流程实现并复验。

本轮没有将有冲突的强命题保留为 confirmed：“MCP 同权限进程绝对不能写资产表”“任何草稿终身只生成一个资产”“复制证明已发送”均不成立于现有证据。它们在候选形成前被收窄，不作为旧工程测试失败计数。
