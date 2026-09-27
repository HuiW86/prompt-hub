# 从 prompt-hub 提炼的能力

本轮完成的是有来源、有边界的共享契约，未抽取公共代码包。共享契约内容与版本以体系目录文件为准，本文件负责映射源实现和证据；不存在第二套成熟度台账。

## 1. 候选及来源

| 资产 | 源实现事实 | 候选稳定职责 | 尚需解耦 |
|---|---|---|---|
| [common:CAP-staged-adoption@0.1.0](</Users/apple/WeChatProjects/架构图体系/capabilities/staged-adoption/0.1.0.md>) | DraftRepo、promote、MCP 路由；C03/C04 | 提案与正式变更分离，采纳事务及待处理去重 | 领域载荷、决策入口、去重域与再次采纳策略 |
| [common:CAP-recoverable-delete@0.1.0](</Users/apple/WeChatProjects/架构图体系/capabilities/recoverable-delete/0.1.0.md>) | soft_delete、trash、七表读取；C05 | 保持身份、恢复可达性与数据约束 | 父子依赖、唯一冲突、读域、永久清理 |
| [common:CAP-guarded-local-replacement@0.1.0](</Users/apple/WeChatProjects/架构图体系/capabilities/guarded-local-replacement/0.1.0.md>) | backup、db、宿主 import_with_backup；C06/C07 | 危险变更前恢复点、失败阻断、替换事务 | 存储接口、数据保留域、字段兼容与恢复校验 |
| [common:PAT-cross-boundary-contract-check@0.1.0](</Users/apple/WeChatProjects/架构图体系/capabilities/cross-boundary-contract-check/0.1.0.md>) | IPC gate、MCP stdio 与 trybuild；C08 | 让跨边界定义/注册/调用可检查，并明确载荷盲区 | 语法抽取、Schema、扩展政策、真实通信适配 |

三项 CAP 的源组件已有本地验证，PAT 有源项目适用证据；**通用契约均为候选**。临时 probe 使用源 crate，只反驳过强保证，不属于独立采用项目。

## 2. 与已有 xianshiqi 资产的实质比较

比较来源为 [上一轮能力分析](</Users/apple/WeChatProjects/xianshiqi/docs/architecture-system-pilot/2026-09-21/capabilities.md>)，本轮没有重跑该项目。

| 既有资产 | prompt-hub 对照 | 决定及原因 |
|---|---|---|
| CAP-action-receipt 0.1.0 | 设备 accepted 是接纳非物理完成；promote 返回 asset_id 是数据库提交后结果 | 共享“明确完成层级”的方法；不把一次数据库提交伪装为设备动作回执实现 |
| PAT-local-control-gate 0.1.0 | 设备本地安全状态决定动作；草稿采纳由人和资产规则决定 | 约束执行方是共同问题，失联/急停与人工审阅不是同一策略；另立 staged-adoption |
| CAP-run-evidence 0.1.0 | 本轮使用 baseline、原始日志、跑次、反例与独立审阅 | 契约字段在不同软件项目里有分析用途；未迁移原采集器，不提升其跨项目成熟度 |
| CAP-axis-adaptation / RCP-voice-device | prompt-hub 没有执行器轴、物理反馈或该组合 | 不适用；协议坐标不是机械坐标，不能按同名“坐标”抽象 |

## 3. 未提升为共享能力的内容

- “认知相位 / 协议坐标 / 漂移账本”目前依赖使用者工作方法；本轮没有第二个领域能支持相同统计含义。
- NSPanel、跨 Space、全局唤起是强平台实现，缺少本轮目标验收，不包装为跨平台“高性能唤起组件”。
- ticket 防陈旧刷新与 copy_seq 取消旧隐藏可作为局部实现经验，尚未证明统一取消模型；不将两个计数器合并成通用调度系统。
- 不发布 RCP：尚未产出独立组件、锁定连接、恢复策略和新场景实测，列几项能力不足以构成可部署组合。

## 4. 下一采用实验

优先建议试用 staged-adoption 到**本地文档元数据修订提案**，以“编辑已有对象、审阅期间对象版本改变”为实质差异。契约中的陈旧版本冲突、原子采纳和 reopen 策略可检验抽象是否足够；这只是有边界的下一任务方案，本轮未创建新产品或修改业务实现。

实施包：锁定采用项目基线 → 定义稳定文档 ID 与版本 → 映射 payload 校验和采纳 → 用临时资料测试重复、陈旧、失败回滚及恢复 → 用该项目的真实边界验证。完成标准是契约成立、差异通过声明扩展表达、质量阈值由采用项目给定并实测。记录阅读、适配、失败修复、验证及维护工时；本轮不虚报节省比例。

所有候选的具体输入输出、反例、迁移验收与退役/重验条件见共享契约。现阶段兼容性为“需要适配，未运行”，不是“开箱即用”。
