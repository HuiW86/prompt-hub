---
type: plan
project: prompt-hub
version: v0.7
created: 2026-05-18
last_modified: 2026-05-19
related: [[spec]], [[product-spec]], [[prd]], [[tech-stack]], [[adr/001-choose-desktop-runtime]], [[adr/002-choose-frontend-framework]], [[adr/003-choose-data-persistence]], [[adr/004-choose-package-manager]], [[adr/006-choose-state-management]], [[adr/007-choose-test-stack]], [[adr/008-enable-macos-private-api]], [[adr/009-choose-styling]]
description: 手动 AI 编程仪表盘的五阶段实施任务清单——主形态优先 + v0.7 锁定全栈技术形态（Tauri 2.x + React 19.2 + Zustand 5 + rusqlite 0.32 + pnpm 9.x + CSS Modules + Vitest 4）
---

# Plan: prompt-hub（五阶段实施任务清单）

> 本文件是 `prompt-hub-prd.md` 拆分版的 **plan.md**——承载实施任务清单。
> 项目定位见 [[spec]]、UI 契约见 [[product-spec]]、数据契约见 [[prd]]。

---

## 实施节奏建议

这份 PRD 不绑定具体实现，但给出一个建议的实施顺序——**按"价值密度"而非"功能完整度"来排**。

> v0.5 实施节奏说明：本节顺序按**主形态优先**重排（哲学八）。主形态承载 80% 使用场景，应先实现并形成稳定的使用反馈，再扩展辅形态。

---

## §0 跨阶段先决条件（实施前 TODO）

> 本节是 v0.6 新增——汇总跨阶段必须在第一阶段写第一行代码之前完成的全局配置 / 替换 / 决策。

### T1 设计 Token 全量落地（必做于第一阶段编码前）

按 [[design-spec]] v0.6 token 体系初始化 CSS Variables 根样式表：

```css
:root {
  /* 字号 — design-spec §2.1 */
  --fs-xs: 0.6875rem;  --fs-sm: 0.8125rem;  --fs-base: 0.875rem;
  --fs-md: 1rem;       --fs-lg: 1.125rem;   --fs-xl: 1.25rem;

  /* 间距 — design-spec §2.2 */
  --space-1: 4px;   --space-2: 8px;   --space-3: 12px;  --space-4: 16px;
  --space-6: 24px;  --space-8: 32px;  --space-10: 40px; --space-12: 48px;
  --space-20: 80px;

  /* 颜色 — design-spec §2.4 */
  --color-text-primary: #1A1A1A;
  --color-bg-default: #FFFFFF;
  --color-protocol-bg: #EEEDFE;   --color-protocol-border: #534AB7;
  --color-task-bg: #E1F5EE;       --color-task-border: #178561;  /* 修订自 #1D9E75，2026-05-18 */
  --color-aux-bg: #F1EFE8;        --color-aux-border: #888780;

  /* 颜色 alias */
  --color-active: var(--color-protocol-border);
  --color-task-accent: var(--color-task-border);
  --color-aux-accent: var(--color-aux-border);

  /* 动画 — design-spec §3 */
  --duration-instant: 100ms; --duration-fast: 200ms;
  --duration-base: 300ms;    --duration-slow: 500ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

**约束**：任何组件 CSS / 内联样式禁止使用裸 px / 裸 hex / 裸 ms 值，必须引用 token。

### T2 旧绿色 `#1D9E75` 全替换（每个阶段编码前自检）

⚠️ **历史 prompt-combiner 改造路径风险**：若复用 prompt-combiner 旧代码（参考 §总实施周期估计），其中可能存在 `#1D9E75` 字面量——必须先全量替换为 `var(--color-task-border)` 或 `#178561`。

> **2026-05-19 ADR-001 后补**：Tauri 2.x 选定后，prompt-combiner 若是 Electron/Node.js 栈，**后端代码无法直接迁移**（需 Rust 重写），仅 React/Vue 前端组件可迁。`#1D9E75` 替换仅是迁移前的最小自检，复用范围决策见待开 ADR-005。

**自检命令**（每个阶段开始前跑一次）：
```bash
rg "#1D9E75|#1d9e75" --type css --type ts --type tsx --type js --type jsx \
  --glob '!node_modules' --glob '!*.lock'
# 期望：0 结果。如有命中，全量替换为 var(--color-task-border)
```

### T3 contrast checker 集成（可选，建议第二阶段加）

把 WCAG 对比度计算集成到 CI / 本地 lint：
- 工具候选：`@adobe/leonardo-contrast-colors` / `wcag-contrast` npm 包
- 触发：任何新增 token 或 token 修订时自动跑实测
- 失败阈值：Non-text < 3:1 或文字 < 4.5:1 阻塞合并

### T4 暗色模式延后确认（v1.1+ 触发）

[[design-spec#2.5 暗色模式（v1.0 占位声明）]] 明确 v1.0 不实现。任何阶段不写 `prefers-color-scheme` 相关代码，等触发前置条件满足后专项立项。

### T5 全栈技术决策锁定（v0.7 新增，建仓前必读）

第一阶段建仓使用以下全栈组合（来源见 [[tech-stack#§3]]）：

| 维度 | 锁定 | ADR |
|---|---|---|
| 桌面运行时 | Tauri 2.x（启用 `macos-private-api`）| [[adr/001-choose-desktop-runtime]] / [[adr/008-enable-macos-private-api]] |
| 前端框架 | React 19.2 + React-DOM 19.2 | [[adr/002-choose-frontend-framework]] |
| 状态管理 | Zustand 5（四层 store：appStore / promptStore / searchStore / settingsStore）| [[adr/006-choose-state-management]] |
| 数据持久化 | rusqlite 0.32 + bundled SQLite（不启 SQLCipher）+ chrono + uuid | [[adr/003-choose-data-persistence]] |
| 包管理 | pnpm 9.x（lockfile 提交，禁用 npm/yarn/bun）| [[adr/004-choose-package-manager]] |
| 构建 | Vite 8.0（Tauri 官方推荐）| D1 自动锁定 |
| 样式 | CSS Modules + CSS variables（不引 Tailwind / CSS-in-JS）| [[adr/009-choose-styling]] |
| 测试 | Vitest 4 + Testing Library + jsdom 29 + cargo test + tempfile | [[adr/007-choose-test-stack]] |
| 全局快捷键 | @tauri-apps/plugin-global-shortcut | D1 自动锁定 |

**仅剩 D8 阻塞**：prompt-combiner 复用范围（[[adr/005-prompt-combiner-reuse]] 仍 Proposed），第一阶段可走「重写」路径不依赖 D8。

**首次 `cargo build` 实测项**（[[tech-stack#§7.1]]）：rusqlite 0.32 + chrono 0.4 + uuid 1.x 组合在 MSRV 1.77.2 下兼容性需建仓时验证；失败需在 ADR 补记并锁版本。

---

## 第一阶段：主形态 MVP（快捷键唤起 + 核心调用）

**目标**：跑通"快捷键唤起 → 对齐 → 看全景 → 一键复制 → 自动隐藏"这个核心闭环。

**技术形态**（全栈基线见 [[#T5]]）：

- 桌面运行时：**Tauri 2.x** + `macos-private-api` feature（[[adr/001-choose-desktop-runtime]] / [[adr/008-enable-macos-private-api]]）
- 前端框架：**React 19.2** + TypeScript 5.x strict（[[adr/002-choose-frontend-framework]]）
- 状态管理：**Zustand 5** — `appStore` 管窗口 visibility / `promptStore` 管 Macro/UsageRecord / `searchStore` 管 query / `settingsStore` 管快捷键与 Phase（[[adr/006-choose-state-management]]）
- 数据层：**rusqlite 0.32 + bundled SQLite** + `chrono` 0.4 + `uuid` v4；数据目录 `~/Library/Application Support/dev.prompt-hub/`（[[adr/003-choose-data-persistence]]）
- 样式：**CSS Modules + CSS variables**（token 全部引用 §0 T1 根样式表，禁止裸值；[[adr/009-choose-styling]]）
- 包管理：**pnpm 9.x**；构建：**Vite 8.0**（[[adr/004-choose-package-manager]]）
- 测试：**Vitest 4 + Testing Library + jsdom 29** 跑前端单元；**cargo test + tempfile** 跑 Rust + SQLite fixture（[[adr/007-choose-test-stack]]）
- 全局快捷键注册（默认 `⌥ Space`，可配置）via `@tauri-apps/plugin-global-shortcut`
- 主形态：全屏覆盖窗口 + 半透明背景（约 92%）+ NSWindow `level` 浮于所有应用上方但不抢焦点（macos-private-api）
- 复制即隐藏 + ESC 关闭

**包含的功能模块**：

- 搜索区（[[prd#5.0-搜索区]]）——⌘K 聚焦，全局兜底
- 相位带（[[prd#5.1-相位带]]）——⌘1-⌘8 切相位
- Macro 快捷区（[[prd#5.2-Macro-快捷区]]）——按热度排序的卡片墙
- Scene 全景区（[[prd#5.3-Scene-全景区]]）——Tab 切换
- 最近使用区（[[prd#5.5-最近使用区]]）——5 条历史
- 复制和使用计数（UsageRecord）

**不包含**：Composition 工作台、SOP 导航、状态仪表、配置入口、副屏形态

**为什么先做这些**：

- 80% 使用场景由"主形态 + Macro + 相位带"覆盖——这部分跑通就比现有工具更好用
- 哲学七（协议对齐）是本项目最特别的设计，必须在 MVP 阶段就能验证
- 辅形态（副屏）依赖主形态的所有模块——主形态先稳，辅形态自然顺

**交付标准**：

- 按下快捷键 0.3 秒内仪表盘弹出
- 点击/回车复制成功，窗口在 200ms 内隐藏
- 任何复制动作都被记录到 UsageRecord
- 相位切换有明显视觉反馈
- ⌘K 搜索能在所有 Macro 和 Phrase 中找到目标

---

## 第二阶段：闭环沉淀（Composition 工作台 + 状态仪表）

**目标**：实现"使用即沉淀"的哲学。

**包含**：

- Composition 工作台（[[prd#5.4-Composition-组合工作台]]，通过 ⌘N 唤起子窗口）
- 状态仪表区（[[prd#5.7-状态仪表区]]）——含相位分布数据
- "未分类草稿"识别和提示
- "保存为 Macro"的自动提示

**交付标准**：使用者重复使用某组合 3 次后，下次唤起时窗口顶部弹出"是否保存为 Macro"提示。状态仪表能展示相位停留分布。

---

## 第三阶段：SOP 导航（时间维度）

**目标**：引入"时间"维度，为未来的自动挡做铺垫。

**包含**：

- SOP 导航区（[[prd#5.6-SOP-导航区]]）——首屏底部右侧
- SOP 模板的创建和编辑
- 从使用历史录制 SOP

**交付标准**：能按照预设 SOP 一步步执行，每步完成后高亮下一步。

---

## 第四阶段:配置与个性化

**目标**：界面本身成为被维护的资产。

**包含**：

- 配置入口（[[prd#5.8-配置与迭代入口]]）——含 Phase 可配置编辑
- 数据导入导出（[[prd#6.9-数据导出-JSON-Schema]]）
- 主形态界面布局的可配置性

**交付标准**：使用者可以在不碰代码的前提下，完整地调整这个工具以适配自己的工作方式变化，包括增删 Phase、调整快捷键、修改 Scene 结构。

---

## 第五阶段：辅形态（副屏常驻视图）

**目标**：扩展辅形态，覆盖 20% 的深度场景。

**包含**：

- 副屏常驻窗口（应用启动时打开，独立窗口模式）
- 共享主形态的所有 UI 模块
- 月度 review 视图（基于 UsageRecord 的长期趋势图）
- 副屏专属：状态持续可见（不会隐藏）
- 副屏专属：Composition 工作台可作为侧栏常驻

**交付标准**：

- 副屏窗口能呈现完整全景，与主形态 UI 一致
- 数据完全共享，主形态做的任何修改在副屏即时可见
- 关闭副屏窗口不影响主形态使用

**为什么放最后**：

- 辅形态是主形态的"翻版"，UI 代码可以大量复用
- 主形态需要充分验证后，才能确定辅形态需要哪些"专属优化"
- 副屏不是所有使用者都有——先把主形态做扎实，覆盖最广人群

---

## 总实施周期估计

- 如果交给 Claude Code 全权实施：3-5 周（前四阶段，Tauri 路径）/ +1-2 周（辅形态）
- 如果手工实现：6-10 周（前四阶段）/ +2-3 周（辅形态）
- 如果基于现有 prompt-combiner 改造：第一阶段可以从 prompt-combiner 的 Composition 功能复用开始，节省约 1-2 周

---

**关联文件**：
- [[spec]] — 项目定位与哲学
- [[product-spec]] — UI 契约
- [[prd]] — 工程契约（数据模型 / 模块字段 / NFR / Boundaries）
