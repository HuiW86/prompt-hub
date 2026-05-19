---
type: tech-stack
project: prompt-hub
version: v0.1
created: 2026-05-19
status: pending-adr  # ⚠️ 待 ADR-001 (桌面运行时选型) 决议后升 v1.0
audience: [ai]
description: prompt-hub 技术栈快照——当前为 stub 状态，桌面运行时与数据层选型待 ADR 决议
related:
  - constitution
  - plan
  - adr/001-choose-desktop-runtime  # Accepted 2026-05-19
---

# Tech Stack: prompt-hub

> ⚠️ **本文件当前为 stub 状态**。prompt-hub 尚未建仓写代码（pre-code 阶段），多项技术选型未拍板。AI 在生成代码前必须先确认对应 ADR 已存在并标 Accepted；若 ADR 未存在，必须先 [[plan]] 流程触发决策，不得擅自选型。
>
> 完整版填写时机：第一阶段 MVP 建仓前（[[plan#第一阶段]]）。

---

## §1 已锁定的技术约束（来自 constitution）

这些不是"选型"，是 constitution 的物理推论，**任何 ADR 不可绕过**：

| 维度 | 约束 | 来源 |
|---|---|---|
| 应用形态 | 桌面原生（非 Web / 非浏览器扩展） | [[constitution#A1]] |
| 数据存储 | 本地存储（localStorage / SQLite / 文件）；禁服务端 | [[constitution#A2]] |
| 网络权限 | 不调用自有后端 API；不上传话术 | [[constitution#A2]] |
| AI SDK | 禁用 anthropic / openai 等 LLM SDK 用于话术生成 | [[constitution#D1]] |
| 性能预算 | 主形态唤起 ≤ 200ms P95 | [[constitution#C1]] |

---

## §2 已确定的子系统

### 2.1 设计 Token 系统

已在 [[design-spec]] v0.6 与 [[plan#§0-T1]] 落地，**任何组件 CSS 禁止使用裸 px / 裸 hex / 裸 ms 值**。

- CSS Variables 根样式表见 `plan.md §0 T1`
- 颜色 / 字号 / 间距 / 动画时长全部 token 化
- 关键颜色：
  - 协议层 `--color-protocol-border: #534AB7`
  - 任务层 `--color-task-border: #178561`（替代旧 `#1D9E75`，自检见 plan §0 T2）

### 2.2 设计契约

详见 [[design-spec]] v0.6，含 WCAG 对比度要求（Non-text ≥3:1，文字 ≥4.5:1）。

---

## §3 待 ADR 决议项（pending）

| # | 决策项 | 候选 | 触发 ADR | 状态 |
|---|---|---|---|---|
| **D1** | 桌面运行时 | ~~Tauri 2.x~~ / ~~Electron 30+~~ | ADR-001 | ✅ **Accepted 2026-05-19**：Tauri 2.x |
| **D2** | 前端框架 | React 19 / Vue 3.5 / Svelte 5 / Solid | ADR-002 | ⏳ pending（第一阶段建仓） |
| **D3** | 数据持久化 | SQLite（drizzle/better-sqlite3）/ JSON 文件 / localStorage | ADR-003 | ⏳ pending（UsageRecord 实现） |
| **D4** | 包管理器 | pnpm / bun / npm | ADR-004 | ⏳ pending（建仓） |
| **D5** | 构建工具 | ~~Vite~~ / ~~Tauri 内置~~ | 自动锁定 by ADR-001 | ✅ **Vite**（Tauri 官方推荐） |
| **D6** | 状态管理 | Zustand / Jotai / 框架内置 | 依赖 D2 | ⏳ pending（第二阶段） |
| **D7** | 全局快捷键 API | ~~Tauri global-shortcut~~ / ~~Electron globalShortcut~~ | 自动锁定 by ADR-001 | ✅ **@tauri-apps/plugin-global-shortcut** |
| **D8** | 是否复用 prompt-combiner 旧代码 | 复用 / 重写 / 部分迁移 | ADR-005 | ⏳ pending（须评估前端组件可迁移性，Rust 后端需重写） |

**决策原则**（不是决策本身）：
- 优先选择支持 A1 + A2 + C1 的组合
- D1 已锁定 Tauri 2.x（[[adr/001-choose-desktop-runtime]]），D2/D3/D4/D8 仍 pending
- D5 / D7 因 Tauri 选定后自动锁定，无需独立 ADR
- 若复用 prompt-combiner（[[plan#§总实施周期估计]]），需在 ADR-005 列出迁移成本——注意 Tauri 选定后后端 Node.js 代码无法直接迁移

---

## §4 填写模板（ADR 决议后回填）

> 当 ADR-001 ~ 005 全部 Accepted 后，删除 §3，按以下模板填 §4 升 v1.0：

```markdown
## §4 运行时与框架

- **桌面运行时**：<Tauri X.Y.Z / Electron X.Y.Z>（ADR-001）
- **前端框架**：<React 19.0 / ...>（ADR-002）
- **TypeScript**：5.x，strict mode
- **Node 版本**：lts/iron 或更新

## §5 数据层

- **持久化**：<SQLite via better-sqlite3 X.Y.Z>（ADR-003）
- **Schema 工具**：<drizzle X.Y.Z / ...>
- **数据目录**：`<OS user data dir>/prompt-hub/`

## §6 工具链

- **包管理**：<pnpm 9.x>（ADR-004），lockfile 提交
- **构建**：<Vite X.Y.Z>
- **测试**：<Vitest X.Y.Z / Playwright X.Y.Z>
- **Lint**：ESLint 9 flat config + Prettier 3.x

## §7 锁定原因（关键依赖）

| 包 | 版本锁定 | 原因 |
|---|---|---|
| <Tauri> | ^2.0 | <2.x 不兼容 1.x，固守> |
| ... | | |
```

---

## §5 升级流程

任何依赖 major version bump 必须走：
1. 开 ADR 评估破坏性变更
2. 升级后跑 [[plan#§0-T2]] 全量自检
3. 更新本文件并 bump version
