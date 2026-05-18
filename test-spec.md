---
type: test-spec
project: prompt-hub
version: v0.1
created: 2026-05-19
status: pre-code
audience: [ai, human]
description: prompt-hub 测试规格——单元/集成/E2E 三层 + 性能基准 + LLM Eval 集（N/A 说明）
related:
  - prd
  - features
  - ops-spec
---

# Test Spec: prompt-hub

> 三层测试金字塔 + 性能基准。**LLM Eval 集 N/A**（[[constitution#D1]] 禁用 LLM SDK），本文件 §6 说明替代方案。
> 覆盖率目标见 [[features#§5]]。

---

## §1 测试金字塔

| 层 | 工具候选 | 覆盖范围 | 触发时机 |
|---|---|---|---|
| 单元测试 | Vitest 1.x | 纯函数 / state machine / 工具函数 | 每次 commit pre-push hook |
| 集成测试 | Vitest + 真实 SQLite | 数据层 + 业务逻辑组合 | 每次 PR CI |
| E2E 测试 | Playwright 1.x | 完整用户 flow（含快捷键 / 窗口切换） | 每次 PR CI + 发布前 |
| 性能基准 | tinybench / 手写 | 唤起延迟 / 渲染 / 数据查询 | 主形态相关代码改动 + 发布前 |

**反金字塔禁止**：E2E > 集成 > 单元 数量倒挂时必须重构（违反则 PR 被 block）。

---

## §2 单元测试范围

### 2.1 核心业务逻辑（必测，覆盖 ≥90%）

| 函数族 | 测试要点 | prd 引用 |
|---|---|---|
| `composition.assemble()` | Modifier 按顺序拼接 / 空 modifier 数组返回空串 / role 缺失时跳过 | [[prd#5.4]] |
| `usage.record()` | append-only 写入 / 不修改已有记录 / target_type 枚举校验 | [[prd#6.8]] |
| `sop.advance(step)` | 步骤推进 / 越界拒绝 / 已完成 SOP 不可再 advance | [[prd#5.6]] |
| `phase.switch(id)` | 切换触发 UsageRecord (target_type='alignment') / 当前相位状态持久 | [[prd#5.1]] |
| `macro.promoteFromComposition()` | Composition → Macro 转换保留 expandFrom / native flag 正确 | [[prd#5.2]] |
| `schema.validate(json)` | 拒绝 `__proto__` / `constructor` 键 / 超长字段拒绝 / 必填字段缺失拒绝 | [[prd#9.1]] |

### 2.2 状态机测试（覆盖 ≥80%）

按 [[prd#7]] 状态机定义：
- `Composition` 状态：`building` → `assembled` → `discarded` 或 `promoted`
- `SOP` 状态：`active` / `paused` / `completed`
- `Macro` 状态：`active` / `deprecated`
- `AlignmentPhrase` 状态：`active` / `deprecated`

**测试格式**：每个状态机用 fsm 测试库（如 `@xstate/test`）穷举所有合法转移 + 拒绝非法转移。

### 2.3 边界约束测试（必测）

来自 [[constitution]] / [[prd#8]]：
- B1: 任何代码引入第 4 类资产 schema → 测试编译期失败（类型层面强制）
- B2: AlignmentPhrase 不能写入 SOP.steps → 数据层 INSERT 拒绝
- 资产数量上限：Modifier 30 / Macro 100 / Scene 10 / Phase 12 / AlignmentPhrase 50 / SOP 20 / Phrase 300——超过时拒绝写入并提示
- 单条话术 ≤5000 字符 → 写入前校验

---

## §3 集成测试范围

### 3.1 数据迁移（[[prd#7.7]]，覆盖 100%）

每个 `migrate_X_to_Y` 函数必须有：
- ✅ 正向迁移成功用例
- ✅ 迁移失败回滚用例（注入伪故障）
- ✅ 备份完整性校验
- ✅ schema_version 字段正确更新
- ✅ FK 引用完整性校验

### 3.2 数据导入导出（[[prd#7.5]]）

- 导出 → 清空 → 导入 → 数据完全恢复（含 UsageRecord 历史）
- 导入恶意 JSON（含 `__proto__`）→ 拒绝 + 数据库无变更
- 导入超大 JSON（>10MB）→ 拒绝
- 跨 schema 版本导入（v1.0 → v1.1）→ 自动迁移

### 3.3 UsageRecord 一致性

- 每个复制操作 → UsageRecord 写入一条
- usage_count 累加与 UsageRecord 条数一致
- 删除 Macro 后 → UsageRecord 标记 orphaned 而非删除（append-only 铁律）

---

## §4 E2E 测试范围

### 4.1 主形态核心 flow（必测）

| Flow ID | 步骤 | 验证点 |
|---|---|---|
| E1 | ⌥ Space → 窗口出现 → 点 Macro → 复制 → 窗口隐藏 | 全程 ≤500ms；剪贴板含 Macro 内容；UsageRecord +1 |
| E2 | ⌥ Space → ⌘K → 输入"调研" → ↓选择 → ⏎ | 搜索结果含 Macro+Phrase+AlignmentPhrase；复制后隐藏 |
| E3 | ⌥ Space → 点 Phase → 默认 AlignmentPhrase 复制 → 窗口隐藏 | 当前相位状态持久；UsageRecord (target='alignment') |
| E4 | ⌥ Space → ⌘N → 拼 3 个 Modifier → 复制 → 提示保存为 Macro（重复 3 次后） | Composition 累计 → Macro 提示触发 |
| E5 | 启动 → 走完 5 步 SOP → 每步高亮 → 完成 | SOP 状态 active → completed；UsageRecord 每步 +1 |

### 4.2 异常 flow（必测）

| Flow ID | 场景 | 验证点 |
|---|---|---|
| X1 | 快捷键冲突（[[user-flows#§5]]） | 弹窗 + 备选方案 + 写入 config |
| X2 | major 升级迁移（[[user-flows#§2]]） | 弹窗 + 强制导出 + 迁移完成 |
| X3 | 数据导入失败（[[user-flows#§3]]） | 事务回滚 + 具体错误显示 |
| X4 | 删除高频 Macro（[[user-flows#§4]]） | 三选项弹窗（取消/deprecated/永久删除） |

### 4.3 跨形态 E2E（部分覆盖）

- 主形态复制 → 辅形态副屏 UsageRecord 即时更新
- 辅形态运行中主形态唤起 → 互不影响

---

## §5 性能基准（regression test）

| 指标 | 目标 | 测试方法 | 失败处理 |
|---|---|---|---|
| 主形态唤起延迟 P95 | ≤200ms | Playwright timing API，跑 100 次取 P95 | block PR |
| 任意点击响应 P95 | ≤100ms | 同上 | block PR |
| 冷启动时间 | ≤1.5s | 启动到 view:home-* 可交互 | warning（非 block） |
| 数据写入延迟 | ≤50ms | UsageRecord 单条写入 | warning |
| 搜索延迟（300 条 Phrase 全文搜索） | ≤100ms | tinybench | warning |

**触发**：任何主形态启动路径 / Composition / 数据层改动必须附 benchmark 结果。

---

## §6 LLM Eval 集（N/A 说明）

> **本节明确声明 N/A 并说明理由**：方法论 §5.10 要求 test-spec 含 LLM Eval 集，但本项目 [[constitution#D1]] 禁用 LLM SDK，工具内部无 LLM 调用——无 LLM 行为可 eval。
>
> **替代方案**：
> - prompt-hub 的"输出"是用户复制到外部 AI 的话术。话术本身的有效性 eval 不在本工具范围（属于用户工作流，应在 Obsidian / 用户笔记内做）
> - 如果未来违反 D1 引入 LLM SDK（须先开 ADR），本节立即升级为完整 LLM Eval 集规范
>
> **方法论盲区**：§5.10 应增加「LLM-free 项目 N/A 子句」，详见 [[~/Vault/.../产品文档体系方法论-实战盲区]]

---

## §7 测试基础设施

### 7.1 CI 流水线（建仓后）

```yaml
# 待 ADR 决议后落地为 .github/workflows/ci.yml
on: [push, pull_request]
jobs:
  unit:       runs vitest run --coverage
  integration:runs vitest --config integration.config.ts
  e2e:        runs playwright test
  bench:      runs scripts/bench.ts vs main branch baseline
  coverage:   uploads to codecov；阈值见 features §5
```

### 7.2 本地 pre-commit / pre-push

- pre-commit: `vitest related <changed>` + lint
- pre-push: `vitest run` 全量单元测试

### 7.3 测试数据策略

- 单元测试：纯函数无 fixture
- 集成测试：每个测试独立的 in-memory SQLite，beforeEach 重置
- E2E：固定 seed 数据集（10 Macro / 8 Phase / 1 SOP），存于 `tests/fixtures/seed.json`

---

## §8 不测的项（明确范围）

- ❌ 第三方依赖本身（Tauri / Electron / React 等不在 prompt-hub 测试范围）
- ❌ 视觉回归（design-spec token 化已经把视觉一致性卡在 lint 层）
- ❌ A11y（暂时手工检查，[[plan#§0-T3]] 未决）
- ❌ 多端同步一致性（[[constitution#A3]] 单人单机，无多端实时同步）
