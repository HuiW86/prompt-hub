---
type: changelog
project: prompt-hub
description: prompt-hub 设计文档体系变更日志——记录文档结构与内容的每次修订
---

# 设计文档变更日志

记录 prompt-hub 文档体系的每次修订，便于追溯决策演变。

格式约定：
- 每次修订记录日期、变更内容、变更原因
- 变更类型：`新增` / `修改` / `删除` / `拆分` / `合并` / `迁移`

---

## 2026-05-20 — M0 建仓校正：pnpm 9.x → 10.x、Vite 8.0 → 7.x

### 变更内容

- **修改** [ADR-004](../adr/004-choose-package-manager.md)：版本基线 pnpm 9.x → 10.x，新增「修订记录」节
- **修改** [09-tech-stack](09-tech-stack.md) v1.0 → v1.1：§3 D4/D5、§4、§6、§7 同步 pnpm 10.x；修正 Vite 8.0 → 7.x（事实校正）
- **修改** [CLAUDE.md](../../CLAUDE.md) §2/§6/§7：同步版本号 + §7 状态指针更新为「M0 技术验证中」
- **修改** [prompt-hub-mvp](../plans/prompt-hub-mvp.md) §0 T5 + 第一阶段：同步 pnpm / Vite 版本

### 变更原因

M0 建仓实测：本机 pnpm 为 10.29.3，create-tauri-app 2.x 模板基线为 Vite 7.3.x。原 tech-stack 锁定的 pnpm 9.x / Vite 8.0 与建仓现实不符——pnpm 取当前大版本 10.x（详见 ADR-004 修订记录），Vite「由 D1 自动锁定」实际跟随 Tauri 模板为 7.x（原 8.0 为误填）。

---

## 2026-05-20 — 文档目录结构重构

### 变更内容

- **迁移** 13 份根目录平铺主文档至 `docs/` 分层结构：
  - 11 篇核心设计文档 → `docs/design/01-11-*.md`（加编号前缀）
  - `plan.md` → `docs/plans/prompt-hub-mvp.md`
  - `adr/*` → `docs/adr/*`
  - `prompt-hub.html` → `dist/prompt-hub.html`
- **新增** `docs/design/README.md`（文档索引表）、`docs/design/CHANGELOG.md`（本文件）
- **新增** `docs/adr/010-doc-directory-restructure.md`（记录本次迁移决策）
- **修改** 全量重写 300+ 处 wikilink 适配新文件名（保留 Obsidian wikilink 体系，仅更新目标名）

### 变更原因

对标 `ai-dev-lifecycle` 项目的目录规范——契约 / 状态 / 知识三层文档应收纳于 `docs/` 而非平铺根目录，核心设计文档采用 `docs/design/` 编号体系。决策详见 [ADR-010](../adr/010-doc-directory-restructure.md)。
