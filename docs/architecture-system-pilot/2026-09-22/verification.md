# 验证结果与偏差处理

基线 [baseline.json](evidence/baseline.json)，本机 Node/pnpm/Rust 版本均有记录。软件测试与两项探针使用源项目或临时数据；没有执行真实库的编辑、导入、清空或恢复。没有修改业务源码，因此这是一轮逆向与方法实作，不是产品缺陷修复发布。

## 1. 实际跑次

| Run | 命令/入口 | 阶段与结果 | 证据和边界 |
|---|---|---|---|
| PH-FE | `pnpm test --reporter=json --outputFile=…/frontend-tests.json` | component，536/536，45文件 | [原始 JSON](evidence/frontend-tests.json)、[元数据](evidence/frontend-run.json)；包含静态门和组件，不是45份真机验收 |
| PH-RUST | `cargo test --workspace --manifest-path src-tauri/Cargo.toml` | integration（含 component/static），227通过，0失败 | [日志](evidence/rust-tests.log)、[元数据](evidence/rust-run.json)；8个非零测试组：10/8/7/1/74/117/3/7 |
| PH-CORE-PROBE | 无 repo-write 依赖，取得 open_write_checked 连接并对临时库写一条 modifier | component，反例成立 | [源码](evidence/probes/core-boundary.rs)、[输出](evidence/probes/core-boundary.log)；说明依赖护栏不是表级权限 |
| PH-REENTRY-PROBE | 临时库执行 promote → 直接再次 promote 被拒 → restore → promote | component，两个不同资产 | [源码](evidence/probes/draft-reentry.rs)、[输出](evidence/probes/draft-reentry.log)；不是 UI 漏洞复现 |
| PH-TARGET | 原生 UI 全链、C1、更新安装与真实库恢复 | not_run | 本轮交付不以操作用户真实数据为前提；组件通过不升级为目标验收 |
| PH-MIGRATION | 共享能力在另一个项目落地 | not_run | 没有指定独立采用项目；方案在能力契约中，未宣称迁移完成 |

原日志保留；摘要 [test-summary.json](evidence/test-summary.json) 为派生计数。Rust 227 与前端536是不同运行域，不相加成“763个完整场景”。两项探针通过仅确认被观察事实，其反驳的更强保证没有通过。

## 2. 需求与验证阶段

| 要求/场景 | 已有本轮证据 | 未覆盖及最小补验 |
|---|---|---|
| 唤起与复制：C1≤200ms P95、内容复制、统计、隐藏 | useCopy、sessionStore、命令门控及错误测试 | OS dispatch、屏幕呈现及可交互时间、多屏/Space、完整延迟分布；需真实显示环境 benchmark 与 UI 验收 |
| 人工采纳与正式资产隔离 | MCP stdio、DraftRepo、promote、无 repo-write 编译失败 | 现有调用路径可信；若要求同权限恶意进程也无法写表，须另设计权限边界并测试；不是当前自动通过项 |
| 删除可撤销 | 七种类型恢复、读取隐藏、默认冲突、清空一致性 | 六个 UI 入口与键盘焦点真机复验，本轮未做；原 HANDOFF 40/34 等保持原状态 |
| 替换前有恢复点、失败不损坏原库 | `import_aborts_when_backup_fails`、迁移快照、事务回滚、导入字段语义 | 断电/磁盘满、跨进程长期竞争、真实备份恢复演练；不能用 quick_check 替代所有完整性条件 |
| 接口一致性 | 三方命令名称集合、部分 MCP 字段、stdio 编解码 | 所有 Tauri 请求/响应载荷、缺失/null/空语义、错误码全链覆盖；优先从有变化的接口补样本 |
| 口令归因 | 同会话、缺锚点、删除/修订等聚合测试 | UI回显 notes 沿用待办54；不能验证AI已收到或质量提升 |

CI 的 bench-c1 仍 `continue-on-error: true`，属于 [HANDOFF 第10项](../../../HANDOFF.md) 既有待办。本轮不改变 C1 阈值，不因软件测试通过而关闭它。

## 3. 偏差、解释与处理

| ID | 预期/声明与当前事实 | 分类、影响与本次处理 |
|---|---|---|
| D01 | AGENTS §7/部分 MANIFEST 摘要仍是早期版本；当前 product-spec v0.29、PRD v0.16、ops v0.5、test-spec v0.15 | 导航漂移。使用文件本体与代码；保留原索引待办3，新增本轮入口，不据此重写规范 |
| D02 | Composition 底层可采纳，UI 明确禁用，暂无承载 | 已知产品边界。按入口分别记账；沿用 HANDOFF 11，不宣称四种草稿都完成用户链 |
| D03 | 注释说“无 repo-write 因此资产表不可达”，原始可写 Connection 可直接执行 SQL | 保证层级过宽。探针证明只可承诺依赖/现有工具路由约束；未发现公开任意 SQL 入口。是否要增加敌对本地进程隔离需另定需求，本轮不自行重构 |
| D04 | 采纳后 discarded 可恢复，再次产生资产 | 对候选“终身一次”保证的反例；不是原需求已确认缺陷。契约仅承诺 pending 去重和当前状态检查；UI可达性未知 |
| D05 | IPC名称相等、MCP测试名写fourteen，容易被读成完整接口验收 | 验证解释偏差。读取实际断言；明确名称/载荷/集合排除/真实通信的差别，不改测试结果 |
| D06 | 代码注释将账本记录称为“actually sent”，实现只在复制后记账 | 证据含义收窄。文档称复制及本地统计，不外推外部接收或效果 |
| D07 | docs/design/ops 已 ratified，MANIFEST 仍称 draft v0.3 | D01 的具体例子；索引不是替代审批来源。保存本轮文档版本摘录供后续导航修订 |

上述差异不静默降级原需求。修改规范、扩大安全保证、恢复 Composition UI、实现 notes 回显均不在“逆向文档+能力提炼+方法反馈”的业务改码范围。

## 4. 下一步最小动作

项目层继续沿用 HANDOFF：54（notes 回显）需要时按既有流程；3（文档索引除锈）应逐条比对文件本体与有效决定；10（C1 CI）需要有显示环境的验证链。对于本轮新增观察，先确认 D03 是否只需修正注释保证范围，D04 是否存在实际需要终身幂等的入口；没有这种需求就保持当前有边界的契约。

体系层的文件、链接、registry 与 Skill 元信息检查结果记录在 [方法反馈](practice-feedback.md)。结构检查不会证明上述命题的真实，也不会自动验证图的每一条语义。
