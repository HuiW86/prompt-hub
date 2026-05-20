---
type: adr
project: prompt-hub
id: ADR-010
status: Accepted
date: 2026-05-20
description: 文档目录结构重构——13 主文档从根目录平铺迁移到 docs/ 分层（design/ 编号 + plans/ + adr/），对标 ai-dev-lifecycle 规范
related:
  - CLAUDE
---

# ADR-010: 文档目录从根目录平铺迁移到 docs/ 分层结构

## 1. 标题与日期

- **标题**：13 份主文档 + 9 份 ADR 从根目录平铺迁移到 `docs/` 分层结构，核心设计文档采用 `docs/design/` 编号体系
- **日期**：2026-05-20
- **决策者**：omar
- **影响范围**：全部 13 主文档 + 10 份 ADR 路径 / 300+ 处 wikilink / `dist/prompt-hub.html` 合订 / `CLAUDE.md` §3 §5 §6 §7 / `HANDOFF.md`

## 2. Status

`Accepted`（2026-05-20）

## 3. Context

### 触发事件

对标 `ai-dev-lifecycle` 项目的目录规范，发现 prompt-hub 将 13 份主文档（spec / prd / ...）全部平铺在仓库根目录，与参照项目「契约 / 状态 / 知识三层文档收纳于 `docs/`」的规范背离。

### 业务约束

- `CLAUDE.md` §5 文档工作流未对物理目录布局做强制约定，留有重构空间
- 根目录平铺导致新文档无明确归属，可扩展性差

### 技术约束

- 13 份主文档之间用 Obsidian wikilink（形如 `[[文件名]]` / `[[文件名#anchor]]`）互引，约 300+ 处；改文件名牵连全部引用
- `dist/prompt-hub.html` 是 14 章 1:1 合订源文件的产物，迁移后内容即过期

### 不决策的代价

- 文档继续平铺，与参照项目规范持续背离
- 后续新增 research / troubleshooting 等知识层文档无处归类

## 4. Options Considered

### Option A: 平铺 `docs/`

- **描述**：13 份文档整体移入 `docs/`，不分子目录
- **优点**：改造量最小；根目录变干净
- **缺点**：未对齐 `ai-dev-lifecycle` 的 `docs/design/` 编号视觉规范；`docs/` 内仍是平铺
- **预估成本**：低

### Option B: 三层分目录 `docs/{contract,state,knowledge}/`

- **描述**：按契约 / 状态 / 知识三层语义分子目录
- **优点**：目录即语义，归属清晰
- **缺点**：与 `ai-dev-lifecycle` 的 `docs/design/` 单目录编号风格不一致；三层划分边界偶有歧义
- **预估成本**：中

### Option C: 复刻 `docs/design/` 编号体系

- **描述**：11 篇核心设计文档 → `docs/design/NN-名.md`（编号前缀）；`plan.md` → `docs/plans/`；`adr/*` → `docs/adr/`；`prompt-hub.html` → `dist/`
- **优点**：与 `ai-dev-lifecycle` 目录规范完全对齐；编号提供稳定阅读顺序；`README.md` + `CHANGELOG.md` 索引机制可直接复用
- **缺点**：文件名加编号前缀，与 wikilink 形成双轨——文档重排序需同步改编号与 wikilink
- **预估成本**：中（300+ wikilink 全量重写）

## 5. Decision

> **一句话拍板**：选择 **Option C**，理由是完全对齐 `ai-dev-lifecycle` 目录规范，编号体系提供稳定阅读顺序且复用其 `README` + `CHANGELOG` 索引机制；wikilink 体系保留（仅更新目标名），不引入相对路径链接以维持 `CLAUDE.md` §5.4 的 anchor 约定。

**为什么不选其他**：

- 不选 A 因为：仅减少根目录噪音，未对齐参照项目的 `design/` 编号规范
- 不选 B 因为：三层语义虽清晰，但与 `ai-dev-lifecycle` 的 `design/` 单目录编号风格不一致，对标不彻底

## 6. Consequences

### 正向后果

- 目录结构与 `ai-dev-lifecycle` 规范完全对齐
- 根目录仅保留 `CLAUDE.md` + `HANDOFF.md` 两个入口文件
- 新增 research / troubleshooting 等知识层文档有明确归属
- 复用 `docs/design/README.md` + `CHANGELOG.md` 索引机制

### 反向后果

- 文件名编号前缀与 wikilink 双轨——文档重排序需同步维护编号与 wikilink
- `dist/prompt-hub.html` 合订过期，需重建后才与当前文档一致（已记录为 backlog）

### 未来反悔成本

- **代码改造规模**：无代码；纯文档移动 + wikilink 重写
- **数据迁移**：无
- **学习成本**：无
- **不可逆点**：无——`git mv` 已保留文件历史；回退只需反向移动 + wikilink 还原，成本与本次迁移相当
- **编号脆弱性**：在 `docs/design/` 中段插入新文档会引发后续编号顺移，需评估是否预留编号间隙

---

## 反模式（写完自检）

- ✅ Options 3 个
- ✅ Decision 一句话 + 明确「保留 wikilink、不引入相对路径链接」边界
- ✅ Consequences 含「编号脆弱性」反悔成本预案

## 相关链接

- **触发本决策的文档**：`ai-dev-lifecycle` 项目 `CLAUDE.md` 目录结构节
- **被本决策影响的文档**：`CLAUDE.md` §3 / §5 / §6 / §7、全部 `docs/design/*` 与 `docs/adr/*` 的 wikilink、`dist/prompt-hub.html`
- **相关 ADR**：无前置；本 ADR 为文档体系结构决策，独立于技术栈 ADR-001~009
