---
type: adr
project: prompt-hub
id: ADR-013
status: Accepted
date: 2026-05-25
description: AlignmentPhrases 从 PhaseBar 子级独立为顶层 region 并加入 Tab cycle（5 → 6 tab-reachable working regions）；追认 ADR-012 Phase 3 已 ship 的代码事实
related:
  - 02-constitution
  - 03-product-spec
  - 05-design-spec
  - 012-lock-visual-quality-anchor
  - prompt-hub-mvp
---

# ADR-013: AlignmentPhrases 独立为顶层 region 并加入 Tab cycle

## 1. 标题与日期

- **标题**：把 AlignmentPhrases 从 PhaseBar 子级（"长按 Phase 展开"）提升为与 PhaseBar 平行的顶层 region，并加入 Tab cycle（5 → 6 tab-reachable working regions）
- **日期**：2026-05-25
- **决策者**：omar
- **影响范围**：[[03-product-spec]] v0.5 → v0.6（§4.0.4 / §4.1 / §13.2 / §13.3 / §13.4 加 alignment-phrases）/ [[05-design-spec]] v0.7 §10.3 组件清单已含 AlignmentPhrases / `src/App.test.tsx` regions() 已 7→8 + Tab cycle 5→6 / `src/layouts/Dashboard.tsx` DOM 顺序已含 AlignmentPhrases / `src/components/AlignmentPhrases.module.css` 已落盘

## 2. Status

`Accepted`（2026-05-25，omar 拍板 Option A）

> 性质：**追认**。Phase 3 commit `acf8229` 已 ship 该行为；本 ADR 把 spec drift 合规化，不引入新代码改动。

## 3. Context

### 触发事件

ADR-012 Phase 3 视觉重写（commit `acf8229`）把 AlignmentPhrases.module.css 独立组件落盘，Dashboard DOM 顺序把 AlignmentPhrases 作为 PhaseBar 平行 region（顶部 SearchBar / PhaseBar / **AlignmentPhrases** / panorama / StatusBar）；App.test.tsx regions() 加 alignmentPhrases、Tab cycle 5 → 6 tab-reachable。代码已 ship，但 [[03-product-spec]] §13.4 / §4.0.4 / §4.1 仍写 5 tab-reachable / 7 一屏全景 region，未含 AlignmentPhrases。

### 业务约束

- [[02-constitution#B1]] 三层资产模型不变 — AlignmentPhrase 仍在 Modifier / Composition / Macro 三层之外（它是 Phase 属下话术，不是任务层资产）
- [[02-constitution#B2]] 协议层与任务层物理分离 — AlignmentPhrases 视觉上仍属协议层（`--protocol` ontology 紫色）
- [[01-spec]] 哲学七（协议对齐）— AlignmentPhrases 是相位带的话术 surface，独立显示加强哲学七视觉权重

### 技术约束

- App.test.tsx 已硬断言 6 tab-reachable + 8 regions（commit `acf8229`）
- Phase 3 已落盘的 AlignmentPhrases.module.css 包含完整 chip 行视觉（`--h-phrases` 44px / `--h-chip` 24px / chip flash 动画）
- spec drift 不修复 = code review 时缺少 spec 锚点，第二阶段 Composition 工作台实施时容易再次混淆 AlignmentPhrases 归属

### 不决策的代价

- design-spec v0.7 / Phase 4 收尾后 spec ↔ 代码继续 drift
- 第二阶段 Composition 工作台实施时无 spec 明确 AlignmentPhrases 是否在工作台中独立显示

## 4. Options Considered

### Option A: AlignmentPhrases 独立为顶层 region + 加入 Tab cycle（追认 ship）— 推荐

- **描述**：把 AlignmentPhrases 视为 PhaseBar 平行 region，独占 chip 行（`--h-phrases` 44px），Tab cycle 包含。spec 同步 bump：§4.0.4 UI 共用规则 7 → 8 模块；§4.1 一屏全景 7 → 8 区域；§13.2 mermaid 图加节点；§13.3 文字描述加区域；§13.4 Tab 行 5 → 6 region
- **优点**：
  - 与 Phase 3 已落盘代码一致 — spec ↔ 代码 sync
  - Tab keyboard nav 完整覆盖 chip 行 — keyboard / a11y 用户有直达路径
  - 视觉权重独立体现哲学七 — chip 行视觉密度独立于 PhaseBar segmented，协议层视觉权重双重落地
  - chip flash 动画 / focused outline 独立可调（不被 PhaseBar 嵌套规则约束）
- **缺点**：
  - spec 改动稍大（§4.0.4 / §4.1 / §13.2 / §13.3 / §13.4 五处 bump，但都是同性质追加）
- **预估成本**：spec 涟漪 ~30 分钟；代码 0 改动（追认 ship）

### Option B: AlignmentPhrases 维持 PhaseBar 子级，Tab cycle 仍 5

- **描述**：把 AlignmentPhrases 视为 PhaseBar 内部展开层（如长按 Phase 才显示浮层），Tab 不直达
- **优点**：spec 改动最小（无 bump）
- **缺点**：
  - 与 Phase 3 已落盘代码冲突 — 需 revert AlignmentPhrases.module.css / Dashboard DOM 顺序 / App.test.tsx
  - chip 行的视觉密度被压缩到浮层 — 哲学七视觉权重倒退
  - keyboard / a11y 用户无直达路径 — chip 行变长按 / 鼠标场景才能触发，违反 [[05-design-spec#§11]] focused 全组件强制
  - bundle 视觉锚点 / Claude Design 派生 sticky context（[[CLAUDE-DESIGN]]）已含 AlignmentPhrases 独立组件 pattern，revert 会引发 L5 派生失效
- **预估成本**：spec 不改但代码 + L5 派生需 revert（高风险，约 1 天）

### Option C（明示排除）: AlignmentPhrases 完全移除（合并回 PhaseBar 复制行为）

- **描述**：取消 chip 行，点 PhaseBar Phase 直接复制默认 AlignmentPhrase（v0.5 设计原意之一）
- **为什么排除**：违反哲学七视觉权重 — AlignmentPhrase 是相位带的话术 surface，必须可见；隐藏后用户无法看到当前 Phase 下有哪些可选 phrase

## 5. Decision

> **一句话拍板**：选择 **Option A — AlignmentPhrases 独立为顶层 region + 加入 Tab cycle**，因为 Phase 3 代码已落盘且 keyboard a11y 完整性 + 哲学七视觉权重独立体现两条理由远超 Option B 的 spec 改动成本。

**为什么不选其他**：

- **不选 B**：会推翻已 ship 的代码（Phase 3 commit `acf8229`）+ L5 派生 sticky context（[[CLAUDE-DESIGN]] 已含 AlignmentPhrases 独立 pattern）+ a11y keyboard nav 倒退
- **不选 C**：违反哲学七 — AlignmentPhrase 是协议层话术 surface，必须可见

## 6. Consequences

### 正向后果

- spec ↔ 代码对齐（消除 Phase 3 commit 后的 spec drift）
- Tab keyboard nav 完整覆盖 chip 行 — a11y / 键盘用户有直达路径
- 哲学七视觉权重通过 chip 行独立体现，不依赖 PhaseBar 内部嵌套
- 第二阶段 Composition 工作台实施时 AlignmentPhrases 归属明确（独立 region，不被工作台占据）
- L5 派生 sticky context（[[CLAUDE-DESIGN]]）AlignmentPhrases 独立 pattern 获 spec 背书

### 反向后果

- [[03-product-spec]] 五处 bump（§4.0.4 / §4.1 / §13.2 / §13.3 / §13.4），维护成本短期上升
- Tab cycle 长度增加 — 用户从最后一个 region Tab 回 SearchBar 多 1 跳；但 chip 行 1 个 Tab stop（整体 cycle，不是 chip 内 Tab），影响有限
- 未来 AlignmentPhrases 显示规则变更（如折叠到 PhaseBar 浮层）需先开新 ADR 替代本 ADR

### 未来反悔成本

- **代码改造规模**：revert 需改 Dashboard.tsx DOM 顺序 + AlignmentPhrases.module.css 改回浮层 + App.test.tsx regions / tab cycle 断言回退 + Dashboard.module.css panorama 网格回退；约 4 文件 ~200 LOC
- **数据迁移**：无（视觉决策不涉及数据）
- **学习成本**：低
- **不可逆点**：用户 UI 已感知 chip 行常驻 — revert 后会感觉"chip 行不见了"，需配合 release note 说明

---

## 反模式（写完自检）

- ✅ Options 3 个（A/B/C），C 显式排除以澄清边界
- ✅ Decision 一句话拍板 + 为什么不选其他全列
- ✅ Consequences 含「未来反悔成本」与具体回退代价
- ✅ 不触动上游底线（B1 三层资产 / B2 协议任务分离 / 哲学七）
- ✅ Status: Accepted（2026-05-25）
- ✅ 性质：追认（Phase 3 已 ship），不引入新代码改动

## 相关链接

- **触发本决策的文档**：[[012-lock-visual-quality-anchor]] Phase 3 视觉重写（commit `acf8229`）/ [[03-product-spec#13.4]] spec drift / Phase 4 涟漪
- **被本决策影响的文档**：
  - [[03-product-spec]] — v0.5 → v0.6（§4.0.4 / §4.1 / §13.2 / §13.3 / §13.4）
  - [[05-design-spec]] §10.3 — 已含 AlignmentPhrases 组件清单
  - [[CLAUDE-DESIGN]] — AlignmentPhrases 独立 pattern 获 spec 背书
  - `src/App.test.tsx` — regions / tab cycle 断言（已落盘）
  - `src/layouts/Dashboard.tsx` — DOM 顺序（已落盘）
  - `src/components/AlignmentPhrases.{tsx,module.css}` — 独立组件（已落盘）
- **相关 ADR**：
  - 前置 [[012-lock-visual-quality-anchor]] — ADR-012 Phase 3 commit 触发本 spec drift
  - 平行 — 无
