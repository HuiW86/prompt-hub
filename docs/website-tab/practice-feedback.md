---
type: practice-feedback
project: prompt-hub
status: draft
author: ai
created: 2026-09-23
---

# 正向实作对体系的反馈

| 实际发现 | 依据 | 体系动作 | 迁移边界 |
| --- | --- | --- | --- |
| 增加“常用网站”看似小 Tab，若未经候选扫描容易另造书签平台或直接把浏览器书签功能搬进应用。 | [S1 扫描与 ADR](prior-art-and-decision.md)、[ADR-030](../adr/030-website-library.md) | `architecture-system/references/forward-build.md` 增加“新建/大幅扩建工具、框架、平台、Skill 或体系前先调用先例扫描与借造决策”的入口提示。该两项 Skill 已有详细规则，不复制内容。 | 触发新建/大幅扩建时；一般组件编辑不强迫 S1 扫描。只经过本轮任务，尚未经独立前测。 |
| 旧导出新增顶层字段时，缺失、空、null 是三个不同用户意图；同时需保证旧库完整。 | [导入实现](../../src-tauri/crates/repo-write/src/import.rs)和 [仓储测试](../../src-tauri/crates/repo-write/src/websites.rs) | `recoverable-local-data` 已明确这些语义及事务/快照规则，本轮证明适用；不增加同义要求。 | SQLite 本地数据与整包导入。 |
| UI → IPC → 持久化 → 系统浏览器有多层成功语义；只按名称调用可能跨层漂移。 | [IPC 名称门](../../src/ipc/ipc-contract.test.ts)、[Rust 打开命令](../../src-tauri/src/commands.rs)、[UI 测试](../../src/components/__tests__/WebsitePanel.test.tsx) | `cross-boundary-contracts` 已覆盖声明/注册/调用对照与回执语义，本轮有效；不增规则。 | IPC 与外部打开动作。自动测试不等于系统浏览器真机成功。 |
| 架构图需要跟随正向任务出图并标定版本/依赖。 | [源图](architecture.mmd)、[设计增量图卡](design-delta.md) | 既有绘图路径可复用；本轮手写小图，无需新增模板。旧逆向图固定在旧源码基线，不假装同步。 | 小功能用关键链路图即可；大规模图维护仍用 registry/check 流程。 |

本轮首次闭环耗时、接口返工和资产维护成本未完整量化，不据此宣称效率提升。验证范围与未跑的真机项见 [执行记录](README.md)。
