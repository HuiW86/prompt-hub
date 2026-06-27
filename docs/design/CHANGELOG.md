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

## 2026-06-26 — ⚠️ ADR-019 推翻 flat 视觉锚点（omar 拍板 Option A：subtle elevation + 放弃颜色本体论，design-spec v0.12 / CLAUDE-DESIGN v0.2 / tokens.css）

### 变更内容

- **新增** [ADR-019](../adr/019-supersede-flat-visual-anchor.md)（`Accepted`，omar 拍板 **Option A**）：推翻 [ADR-012](../adr/012-lock-visual-quality-anchor.md) 的「反 polish / Bloomberg-flat」视觉锚点，启用其当年明示排除的 Option E——引入 subtle elevation（box-shadow）+ 放弃颜色本体论，全面对齐 Promptscape。**关键校正**：颜色本体论与反阴影底线住 design-spec §2.4.1/§8.2（🤝 AI 可起草层），constitution B2 只管结构分离不管颜色——故无 🧑 人主笔门槛（ADR-019 草案此前误写「须人主笔改宪法」，已修正）
- **修改** [ADR-012](../adr/012-lock-visual-quality-anchor.md)：Status `Accepted` → `Superseded by ADR-019` + 校正备注（当年把门槛挂宪法是不精确表述）
- **修改** [05-design-spec](05-design-spec.md) v0.11 → **v0.12（major）**：§2.4.1 颜色本体论降「视觉选择级」转中性；§5 撤反阴影 + 颜色冗余改靠位置+形状；§6 PhaseBar 紫降为可选；§8.1 锚点重定向 `ADR-019 > Promptscape > CLAUDE-DESIGN > bundle`；§8.2 撤 box-shadow 禁项 + 新增 §8.2.1 elevation 允许范围；§10.1 hover 允许 subtle shadow；§13 整章重定向（权重靠位置+形状+elevation；§13.2「=违宪」重写为「视觉一致性级」，保留结构分离铁律）
- **修改** [CLAUDE-DESIGN](CLAUDE-DESIGN.md) v0.1 → v0.2（L5 派生，**⚠️ 待 omar 重传 Claude Design**）：移除「No box-shadow」hard exclusion + 加 Elevation 节 + 颜色本体论降中性默认
- **修改** `src/styles/tokens.css`：新增 `--shadow-1`/`--shadow-2`（dark 默认 + light override，随主题切换）；ontology token 注释改「可选强调」
- **修改** [07-features](07-features.md) / [03-product-spec](03-product-spec.md)：物理分离条备注更新（视觉区分改位置+形状，B2 仍纯结构）；related + 关联引用补 ADR-019、ADR-012 标 Superseded

### 变更原因

[ADR-018](../adr/018-absorb-promptscape-design.md) 吸收 Promptscape 设计稿后，实现与设计稿反复「不一样」。诊断发现差异核心是 ADR-012 的反阴影 flat 锚点与设计稿的 elevation 抬起感对撞。omar 拍板 Option A（全面推翻），接受「中性配色 + 协议/任务一眼区分从颜色维度降为位置+形状维度」的产品手感取舍。本次先落文档层（ADR + design-spec + CLAUDE-DESIGN + tokens + features/product-spec 回写）；tokens 的 `--shadow-*` 已加，组件 CSS 转中性 + 抬起态改造另行落地。constitution / spec 未触动——颜色本体论本就住 design-spec，无人主笔门槛。

---

## 2026-06-25 — ADR-018 补遗-1 Promptscape 保真度三调整（默认浅色 / 补 Modifier 右栏 / Scene 编号，代码已落地待人审）

### 变更内容

- **修改** [ADR-018](../adr/018-absorb-promptscape-design.md)：追加「补遗-1（2026-06-25）」记录三项保真度调整，**反转**本 ADR 原两项决策（默认暗→浅 / 补回 Modifier 右栏），AI 起草、待 omar 追认
  - **R1** `settingsStore.themeMode` 默认 `system` → `light`（浅色为参考外观，暗色仍可选）；未重绘 light token
  - **R2** 新增 `ModifierGrid`（aside 顶部紧凑 chip 卡，4 象限 groupKind 分组，click-to-copy）——展示型区块，不进 §13.4 Tab 循环；B1/B2 复检通过；Modifier 复制走 clipboard 直拷不记 usage（`UsageSource` 无 modifier 值）
  - **R3** Scene 只读视图子阶段头补 `01/02…` 序号；保持 auto-fill 多列（未改固定 4 列）

### 变更原因

omar 复审设计稿后指示「Scene 区和右栏 aside、配色都调整一致」，将先前 ADR-018 的三处「有意偏离」中两处（无 Modifier 右栏 / 暗色默认）按设计稿调回，并给 Scene 补编号。代码已落地全绿（`pnpm test` 98/98 ✓ / `build` ✓ / `lint` ✓ / `prettier` ✓，后端 Rust 未动）。因 R1/R2 实质反转已 ratified 的 ADR-018 决策，以补遗形式记录并标待人审；追认后再回流 design-spec（§2.5 默认模式 + §10.8 ModifierGrid）/ product-spec（§13.3 aside Modifier 块）/ features，不就地补丁。

---

## 2026-06-25 — ADR-018 Promptscape 设计吸收落地涟漪（product-spec v0.10 / design-spec v0.11 / features v1.5）

### 变更内容

- **新增** [ADR-018](../adr/018-absorb-promptscape-design.md)（`Accepted`）：以「改造现有组件」吸收 Claude Design「Promptscape 全景仪表盘」约 90% 视觉收益，组合锁定 A1+B1+C1+D+E；三处放大决策（D1 任务层 3→2 列 / D2 新增 slim Header / D3 省略全局新建按钮）。作为本批 5 份文档涟漪的共同上游锚点
- **修改** [03-product-spec](03-product-spec.md) v0.9 → v0.10：§13.2 mermaid 重绘（+顶栏 Header / +协议带 / 全景双列 / +设置弹窗 SET 节点 + 边/样式校正）；§13.3 新增区域 0 Header + 区域 9 设置弹窗，更新区域 1/3/4/8 行为；§13.4 ⌘, 改为唤起设置弹窗；新增修订记录 v0.10
- **修改** [05-design-spec](05-design-spec.md) v0.10 → v0.11：新增 §2.4.4（中性强调色 + scrim token 表 + 强调色三铁律）；§2.5 主题三态实装契约 + applyAppearance 示意；§10.3 更新 MacroGrid/ScenePanel + 新增 Header/ProtocolBand/SettingsModal 行；新增 §10.8（三吸收组件视觉契约 + B2 复检）；§13.1 加「中性强调 ≠ 第四语义层」note；新增修订记录 v0.11
- **修改** [07-features](07-features.md) v1.4 → v1.5：新增 §3.11 Promptscape 吸收区（6 功能 → `done`：主题三态 / 强调色 / 设置弹窗 / Header / ProtocolBand / 2 列全景）；§4 节奏表加 Promptscape 行，合计 59 → 65 项；§6 变更日志补记
- **修改** [ADR-016](../adr/016-choose-dnd-and-resizable-layout.md)：追加「补遗（2026-06-25，ADR-018 Promptscape 吸收）」——任务层 3→2 列、resizable group id `3col` → `panorama-2col`（丢弃旧三列布局缓存），不改本 ADR §4–§6 原决策（仍 react-resizable-panels v4）

### 变更原因

Claude Design 产出「Promptscape 全景仪表盘」设计稿（slim Header / 协议层暗色 band / 任务层双栏全景 / 设置弹窗 / 主题三态 + 中性强调色），视觉气质显著优于现状。但设计稿带账号头像、Modifier 右栏、改名 Promptscape，均与项目约束（[[02-constitution#B1]]/[[02-constitution#B2]]/spec §8.2 无账号）冲突，不能整稿吞下。omar 拍板组合 A1+B1+C1+D+E（保语义色 + 不引 Modifier 右栏 + 改造现有组件 + 接既有 store + 保 prompt-hub 名去头像），在不破任何 constitution 铁律前提下拿约 90% 视觉收益且零数据迁移（仅 localStorage 布局 key 迁移）。代码已落地全绿（`pnpm build` ✓ / `pnpm test` 97/97 ✓ / lint ✓ / prettier ✓，后端 Rust 未动）。按方法论 §7 八步把代码事实回流 5 份文档，以 ADR-018 为共同上游锚点。

---

## 2026-06-19 — ADR-017 自动更新客户端 + CI 出包落地涟漪（features v1.1 / tech-stack v1.3）

### 变更内容

- **修改** [07-features](07-features.md) v1.0 → v1.1：新增 §3.9 自动更新区（5 功能：updater 客户端接入 / opt-in 总开关+UI / Vite 加固 / CI 出包 → `done`，真机验收 → `planned`）；§4 节奏表加 ADR-017 行，合计 51 → 56 项；§6 变更日志补记
- **修改** [09-tech-stack](09-tech-stack.md) v1.2 → v1.3：§3 决策表加 D14（自动更新机制）；§4 新增 §4.4 自动更新子系统（updater + process + serde_json + GitHub Releases + Actions two-job 隔离 + A2 出站豁免边界 + 密钥隔离三战线）；§7 依赖锁加 `@tauri-apps/plugin-process` + updater 注 ADR-017；frontmatter related 补 016/017
- **修改** [CLAUDE.md](../../CLAUDE.md) §7：ADR 进度 14 → 16 Accepted（补 016 + 017）；新增「自动更新（ADR-017）」状态指针行；tech-stack v1.2 → v1.3；下一动作切换到 ADR-017 收口 + Phase 6 真机待办
- **修改** [docs/MANIFEST.md](../MANIFEST.md)：§8 ADR 表补 016 + 017（14 → 16 份）+ §1 概览计数；features v0.3 → v1.1 / tech-stack v1.2 → v1.3；顺带校正 prd v0.9 → v0.10 / ops-spec v0.2 → v0.3 drift

### 变更原因

[[017-enable-auto-update]] Accepted（2026-06-17）后，客户端 Phase 1-3 + CI Phase 4 代码已 landed 并跑通端到端 dry-run（Phase 0 密钥 + `release-signing` Environment 配齐，run 27855601462 全绿：双架构 build + minisign 签名 + latest.json 核验；过程修 4 个真实 CI bug——pnpm version / .p12 密码 / Developer ID 证书 localKeyID 抽取 / macOS bash 3.2 关联数组）。按方法论 §7 把代码事实回流到 features（功能矩阵）+ tech-stack（依赖登记）+ CLAUDE §7（状态指针）+ MANIFEST（清单）。draft release v0.1.0 为 dry-run 产物已删，非真实首发。Phase 6 真机验收为唯一待办。

---

## 2026-06-17 — ADR-017 自动更新隐私披露 gate 前置（ops-spec v0.2 / prd v0.9）

### 变更内容

- **新增** [10-ops-spec](10-ops-spec.md) v0.1 → v0.2：§9「出站网络与隐私披露（自动更新）」——按 ADR-017 §5.1 诚实记账唯一出站场景 / 协议层被动元数据（IP+时间戳 / SNI·JA3 / UA 覆盖）/ 节律与开关（首启 opt-in + 总开关零出站 + 低频去节律指纹）/ 与 §5.2 禁用监控正交
- **修改** [06-prd](06-prd.md) v0.8 → v0.9：§7.3 隐私加 updater 唯一出站例外指针（C1）；§8.2 N1 override 列开「唯一显式声明的受限豁免」口子指向 [[017-enable-auto-update]] / [[10-ops-spec#§9]]（C2）——消除 prd 字面「任何外部网络请求=违反、无 override」对 updater 的否决
- **修改** [docs/MANIFEST.md](../MANIFEST.md)：ops-spec → v0.2 / prd v0.7（实际 v0.8，顺带修正 drift）→ v0.9

### 变更原因

[[017-enable-auto-update]] §5.1 把「用户隐私说明出站披露」列为转 Accepted 的 **ratification gate**——披露文档悬空则 A2 豁免链断在最后一环、不得批准。项目无独立隐私说明文档，故落 1+2 组合：核心披露事实落 ops-spec §9（运维/行为层），prd §7.3 + N1 加豁免 note 解内部冲突。C3（prd L2 网络权限描述）/ C4（ops-spec §5.2 telemetry 措辞）按拍板 defer 到批准后实现涟漪。ADR-017 状态仍 Proposed，本次仅前置 gate 文档，状态改写待人主审（§5.2）。

---

## 2026-06-11 — product-spec Tab cycle 6 → 8（v0.8，AE P2.4 涟漪）

### 变更内容

- **修改** [03-product-spec](03-product-spec.md) v0.7.1 → v0.8：§13.4 Tab cycle 6 → 8 tab-reachable（顺序按 DOM：相位带 / 对齐话术 / Macro / Scene / 拼装工作台 / 最近 / Modifier 四象限 / SOP）；v0.7 badge note 措辞时间戳化
- **修改** [ADR-013](../adr/013-alignment-phrases-tab-inclusion.md)：新增「谱系备注」（6 → 8，沿用原判断逻辑，不另开 ADR）
- **修改** `src/App.test.tsx`：tabindex 断言 6 → 8（补 composition-workbench / modifier-grid 两 landmark）
- **修改** [docs/MANIFEST.md](../MANIFEST.md)：product-spec v0.7 → v0.8

### 变更原因

AE plan P2.4 落地 ModifierGrid / CompositionWorkbench 两编辑工作面（均 `tabIndex=0`），文档记录的 6 tab-reachable 与实际 8 不一致。omar 拍板选 (a) 回流文档：代码已 ship / 键盘 a11y 不可倒退 / design-spec §11 focused 全组件强制，判断逻辑与 ADR-013 同构。

---

## 2026-05-25 — design-spec §12 边界澄清（v0.7.1）

### 变更内容

- **修改** [05-design-spec](05-design-spec.md) v0.7 → v0.7.1：新增 §12.4「适用范围（chrome vs 用户内容）」——§12.1-§12.3 lucide-react hard rule 只覆盖 chrome 系统图标；用户内容图标（Scene/Macro/AlignmentPhrase 自定义）允许 emoji / 单字 / lucide name 等任意字符
- **修改** [docs/MANIFEST.md](../MANIFEST.md)：design-spec v0.7 → v0.7.1

### 变更原因

Phase 5 manual verify 截图自检（CGWindow `screencapture -l` 抓 off-screen Tauri 窗口）发现 Scene tab 渲染 emoji（`📐 🔍 🔧`，来源 `migrations/0002_seed.sql`），与原 §12 lucide-react hard rule 表面冲突。根因是 §12 未区分 chrome vs 用户内容边界。澄清后不需改代码——emoji 属于用户表达自由范畴。

---

## 2026-05-25 — ADR-012 Phase 4 设计文档涟漪 + ADR-013 追认

### 变更内容

- **新增** [ADR-013](../adr/013-alignment-phrases-tab-inclusion.md)（`Accepted`）：追认 ADR-012 Phase 3 已 ship 的 AlignmentPhrases 独立顶层 region + Tab cycle 5 → 6 tab-reachable
- **修改** [05-design-spec](05-design-spec.md) v0.6 → v0.7（**分 2 commit**）：
  - Stage 1（commit `1aa8324`）：§1-§7 token 命名 sync 到 tokens.css 单一真源——`--fs-*/--space-*/--color-*/--duration-*` → `--t-N/--s-N/--protocol/--task/--aux/--canvas/--surface/--border/--fg/--d-/--ease` + sub-grid precision tier + 组件 anchor 高度 + opacity token + dark mode v1.0 已实装
  - Stage 2（commit `fc20a97`）：§8-§13 新增 6 章——视觉锚点（Linear-class + 7 hard exclusions）/ 7 个 `.ph-*` typography presets / border-only 组件 pattern + 共享 primitive 三件套（RegionHeader / EmptyState / Kbd）/ 9 态契约 / lucide-react icon 系统（icon 不承载 ontology）/ 视觉权重三层规约（cross-contamination = constitutional violation）
- **修改** [03-product-spec](03-product-spec.md) v0.5 → v0.6：§4.0.4 UI 共用 7 → 8 模块 / §4.1 一屏全景 7 → 8 区域 / §13.2 mermaid 加 AP 节点（顺手修 `#1D9E75` 旧绿 → `#178561` 新绿，sync §2.3.3）/ §13.3 新增「区域 2-bis 对齐话术」/ §13.4 Tab cycle 5 → 6 region；新增「修订记录」章节
- **修改** [07-features](07-features.md) v0.1 → v0.2：S1 主形态 MVP 5 模块 + AlignmentPhrases chip 行 + 跨模块 6 项 P0 状态 `planned` → `done` / 「复制即隐藏」+「UsageRecord」P0 `in-progress` / §7 当前阶段说明 pre-code → in-progress，含 commit 哈希与测试通过数 / status 字段 pre-code → in-progress
- **修改** [CLAUDE.md](../../CLAUDE.md) §7 当前状态指针：项目阶段 → ADR-012 Phase 1-3 全 ship + Phase 4 涟漪进行中 / ADR 进度 11→12 Accepted + 加 ADR-013 / 下一动作切换到 Phase 5 manual verify
- **归档** [docs/mockups/prompt-hub.html](../mockups/prompt-hub.html) → `docs/mockups/archive/v1-engineer-aesthetic.html`（保留作为 ADR-012 前的视觉对比基线）
- **修改** [docs/MANIFEST.md](../MANIFEST.md)：design-spec v0.6 → v0.7 / product-spec v0.5 → v0.6 / features v0.1 → v0.2 / ADR 12 → 13 / mockup 状态归档

### 变更原因

ADR-012（[[012-lock-visual-quality-anchor]]）Phase 1/2/3 视觉重写代码已 ship（commit `b932ab4 → 9a822d8 → acf8229`），但 design-spec v0.6 仍 token-only、§1-§7 token 命名与 tokens.css 已 drift、§8-§13 视觉锚点章节空缺；product-spec §13.4 Tab cycle 仍 5 region；features 全部 `planned`。Phase 4 涟漪走方法论 §7 八步流程把代码事实回流到 spec：3 个原子 commit（design-spec §1-§7 sync / design-spec §8-§13 新增 / 多文件涟漪），消除全部 drift。

ADR-013 追认 Phase 3 已 ship 的 AlignmentPhrases 独立 region 行为，避免被误读为"spec 改了代码"。

---

## 2026-05-24 — L5 协作契约层引入（ADR-012 涟漪）

### 变更内容

- **新增** `docs/design/CLAUDE-DESIGN.md`：Claude Design (claude.ai/design) 的 sticky context 派生文件，含色块即本体 + 反设计禁忌 + typography 组合 + 组件清单
- **新增** `docs/workflows/claude-design-prompts.md`：3 个 per-task prompt 模板（α 全主形态 / β 单组件 / γ 状态规格）+ handoff workflow + 迭代 checklist + 3 个 footguns
- **新增** `docs/MANIFEST.md`：项目全文件总清单，按方法论 v1.3 六层架构组织
- **修改** [README.md](./README.md)：description 加 L5 派生上下文 + 新增 §L5 派生上下文（协作契约）节
- **修改** [CLAUDE.md](../../CLAUDE.md) §3 三温区：温区加 CLAUDE-DESIGN + claude-design-prompts；冷区加 MANIFEST.md
- **修改** [CLAUDE.md](../../CLAUDE.md) §7 当前状态指针：文档体系字段加 L5 + ADR 进度更新（+012）
- **同时 bump** `~/Vault/知识库/方案模板/产品文档体系方法论.md` v1.2 → v1.3：加 L5 协作契约层概念 + 5.15/16 文档规范 + 7.7 派生 bump 规则

### 变更原因

第一阶段 MVP 实施后发现 design-spec v0.6 token-only 没给「质感锚点 / 组合规则 / 组件 pattern / 状态规范 / icon / 视觉权重」，AI 实施时按字面拼 token 出工程师审美 UI。ADR-012 锁 Linear-class 整体气质后，需要把质感锚点固化成**外部 AI 工具（Claude Design 等）能接受的接口契约**——这是「L5 协作契约层」。

该层与 L0–L4 性质不同：派生自上游而非自源、bump 触发包括"外部 AI 工具能力升级"。详见方法论 v1.3 §5.15-16。

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
