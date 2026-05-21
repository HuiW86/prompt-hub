---
type: adr
project: prompt-hub
id: ADR-004
status: Accepted
date: 2026-05-19
description: 选择 pnpm 作为包管理器——Tauri 2.x 项目主流选择 + 严格 dep 解析（无幻 hoisting） + content-addressable store 节省磁盘
related:
  - 09-tech-stack
  - 001-choose-desktop-runtime
  - CLAUDE
---

# ADR-004: 选择 pnpm 作为包管理器

## 1. 标题与日期

- **标题**：选择 pnpm 10.x 作为前端包管理器
- **日期**：2026-05-19
- **决策者**：omar
- **影响范围**：[[09-tech-stack#§3-D4]] resolved / [[CLAUDE#§2]] 关键命令 `<pm>` 占位全部替换 `pnpm` / CI 脚本（`.github/workflows/*.yml`）

## 2. Status

`Accepted`（2026-05-19）｜版本基线 9.x → 10.x 修订于 2026-05-20（见文末「修订记录」）

## 3. Context

### 触发事件
[[CLAUDE#§2]] 关键命令中 `<pm>` 占位待解锁；[[001-choose-desktop-runtime]] 后所有依赖管理需要明确工具。

### 业务约束
- [[02-constitution#A2]] 本地优先 — 包管理器自身不能引入云依赖（pnpm/bun/npm 都满足）
- [[02-constitution#C1]] 主形态 200ms 唤起 — 与包管理器无关，但启动时依赖加载路径有间接影响

### 技术约束
- 与 Tauri 2.x / Vite / TypeScript 兼容
- monorepo 可能性（虽 prompt-hub 单包，但保留未来工具拆分空间）
- lockfile 跨平台稳定（macOS / Windows 一致解析）

### 参考验证
VaultX 未明示，但 Tauri 2.x 官方模板 + 主流社区项目（含 1Password CLI / Vencord 等）默认 pnpm。

### 不决策的代价
- 建仓脚本无法初始化
- `package.json` 的 packageManager 字段无法填
- CI 缓存策略无法定型

## 4. Options Considered

### Option A: pnpm 10.x

- **描述**：content-addressable store + 严格 dep 解析（无幻 hoisting）
- **优点**：
  - **严格 dep 解析**：只能访问 package.json 显式声明的依赖，杜绝幻 hoisting 引发的「本地能跑生产挂」
  - **磁盘高效**：全局 store 去重，多项目场景节省 GB 级磁盘
  - Tauri 2.x 项目主流，社区例子最多
  - lockfile（`pnpm-lock.yaml`）稳定，跨 OS 一致
  - workspace 协议（`workspace:*`）天然支持 monorepo
- **缺点**：
  - 部分老库未声明 peerDependencies 时会出 warning（但通常可解）
  - Windows 上首次安装 ESM-only 包偶有路径长度问题（已修复但偶发）
- **预估成本**：0（团队/AI 已熟悉）

### Option B: bun 1.x

- **描述**：JS 运行时 + 包管理器一体，2024 GA
- **优点**：
  - 安装速度最快（native binary + 并行）
  - 内置 TypeScript / JSX / SQLite 等
  - lockfile（`bun.lockb`）二进制紧凑
- **缺点**：
  - lockfile 二进制 — diff 不可读
  - Windows 支持较新（2024 才完整）
  - Tauri 模板对 bun 适配略晚
  - 部分 npm 包在 bun runtime 下有兼容性问题（虽不影响纯 install）
- **预估成本**：低，但前沿性带来潜在踩坑

### Option C: npm 10.x

- **描述**：Node.js 自带，最广兼容
- **优点**：零额外安装、兼容性最好
- **缺点**：
  - 慢（顺序安装 + 大量 IO）
  - hoisting 默认开启，dep 解析松散
  - lockfile（`package-lock.json`）变更噪声大
- **预估成本**：0 安装成本但日常使用成本累积

## 5. Decision

> **一句话拍板**：选择 **pnpm 10.x**，理由是 Tauri 2.x 主流 + 严格 dep 解析（契合 prompt-hub 单一真相源精神）+ 磁盘高效（适合长期常驻桌面工具的本地开发环境）。

**为什么不选其他**：
- 不选 bun 因为：lockfile 二进制不可 diff，2026 跨 OS 一致性还在磨合，不适合作为 MVP 阶段的关键基础设施
- 不选 npm 因为：默认 hoisting 引入隐式依赖污染，与项目「每条规则挣得位置」精神相悖

## 6. Consequences

### 正向后果
- 解 [[09-tech-stack#§3-D4]]
- [[CLAUDE#§2]] `<pm>` 占位全部替换为 `pnpm`（涟漪改动）
- CI 缓存 key 可基于 `pnpm-lock.yaml` 内容稳定
- workspace 协议保留未来拆 packages/ 的可能性

### 反向后果
- 团队成员若用 npm 跑 `npm install` 会引入 `package-lock.json` 冲突 — 需在 CLAUDE.md 加禁令或在 `.gitignore` 排除
- pnpm symlink 模式在某些 Electron-style 工具（如 patch-package）有兼容问题（但 Tauri 不受影响）

### 未来反悔成本
- **代码改造规模**：极小 — 删 lockfile + 重新安装；少量 CI 脚本调整
- **数据迁移**：无
- **学习成本**：无（npm/pnpm 命令行接口相似）
- **不可逆点**：无 — 包管理器是最易切换的决策之一

---

## 修订记录

### 2026-05-20 — 版本基线 9.x → 10.x（建仓校正）

M0 建仓（[[prompt-hub-mvp#M0]]）时本机 pnpm 为 **10.29.3**。本决策 2026-05-19 拍板时项目仍 pre-code、未实际 scaffold，"9.x" 是当时的当前大版本；建仓时 pnpm 已迭代至 10.x，无降级理由，故将版本基线校正为 **pnpm 10.x**。

- **包管理器选择不变**：仍是 pnpm，§4 Options 与 §5 Decision 理由全部成立
- **唯一行为差异**：pnpm 10 默认不再自动执行依赖的 build script，需在 `package.json` 的 `pnpm.onlyBuiltDependencies` 显式白名单——当前已加入 `esbuild`（Vite 传递依赖）
- **不构成 §8 意义上的 major bump**：项目此前 0 LOC、无 lockfile，不存在「从 9.x 升级」的迁移，仅是初始基线校正，故沿用本 ADR 而非新开 ADR

## 反模式（写完自检）

- ✅ Options 3 个
- ✅ Decision 一句话
- ✅ 反悔成本如实标「极小」

## 相关链接

- **触发本决策的文档**：[[09-tech-stack#§3-D4]] / [[CLAUDE#§2]]
- **被本决策影响的文档**：[[CLAUDE#§2]]（涟漪 `<pm>` → `pnpm`）/ CI workflow 待建
- **相关 ADR**：前置 ADR-001 / 独立于 ADR-002/003/006
