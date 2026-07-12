# UX 任务流静态预审 — 基线数据与分级问题池（2026-07-12）

> 走查方法升级：上一轮 CRUD 矩阵回答"有没有入口、能不能完成"；本轮回答**用户能否连续、低犹豫、可恢复地完成一件真实任务**。
> 三个并行审计 agent（A1 任务流 / A2 排版合规 / A3 响应式）**只读源码扫描**产出，主会话合并 HANDOFF 已知项后统一分级。
> **评审状态**：v1 经 omar Request changes（2026-07-12），本版已按六项裁决 + D-0 修订。
> 支撑决策：ADR-022（跨 Scene 移动，待立项）+ product-spec / design-spec §7 八步回流。

**证据等级约定**（本文档所有结论必须标注）：
- `source-confirmed` — 源码可证机制存在/缺失（本轮全部 agent 产出的默认上限）
- `test-confirmed` — 有自动化测试覆盖证实
- `live-confirmed` — 真机实测证实（可发现性/犹豫/焦点连续性/完成时间**只能**由此级证实）

> ⚠️ 本文档是**静态预审**，不是体验基线。真实体验基线需在 1024×640 验收档（见 D-4）真机走查后另行建立。

---

## §0 产品裁决记录（omar，2026-07-12）

| # | 裁决 |
|---|---|
| **D-0** | **主形态增加显式整理模式**（三选一裁决：提前实现辅形态 / 主形态显式整理模式 / 共享持久化 interactionMode → 选中间者，含持久化 interactionMode）。默认**调用态**保留整卡复制；**整理态**整卡改为选择/预览，复制降为显式动作，所有写操作保持窗口驻留。**不按 source=scene/search 区分隐藏**——Scene 同时承担调用和整理，来源无法表达意图 |
| D-1 | 保留调用态整卡复制；整理态抑制 |
| D-2 | 隐藏行为按显式模式区分，不按来源区分（D-0 推论） |
| D-3 | 正文 14px；可点击文字至少 13px；**卡片/区域标题不必一律升 16**——Scene/page title 16px，其余层级由字重和位置承担 |
| D-4 | **拒绝 720×480**（推导不成立：720×20%=144px 保不住 200px chip；且主窗口每次唤起走 `fit_to_active_monitor`（lib.rs:24/149/201），非自由缩放窗口，贸设 minWidth 反而可能小屏溢出）。先以目标设备最小逻辑分辨率做截图与真机基线；**初始验收档 1024×640**；面板自身用像素内容下限。Tauri minWidth/minHeight 只在辅形态窗口真正落地时单独配置 |
| D-5 | 撤销按数据语义分路，**toast 只是入口不是恢复能力**：移动→短时撤销（`move_phrase` 返回原 scene/sub_stage/order_index receipt）；Draft discard→支持撤销状态；Phrase 永久删除→v0.1 继续二次确认；Phrase 可撤销删除→将来单独做 soft-delete/restore 数据设计 |
| D-6 | v0.1.0 前完成：批次 A、批次 B、footer wrap（A3-02）、1024×640 真实尺寸基线。**C-1 不以"零风险重构"插队**；完整排版与响应式批次放发布后 |

---

## §1 三条全局结论（比单个问题更重要）

1. **最大的体验问题是"调用态与整理态没有显式分离"。**（source-confirmed）
   Scene 看板把「调用」（整卡点击=复制，`ScenePanel.tsx:887`）与「整理」（增删改排）压在同一交互面；后端对任意复制 200ms 后无条件 `window.hide()`（`commands.rs:147-158`），不区分意图。整理时想点开看内容 → 一点即复制 + 被踢出窗口。T7 连续整理的断裂是结构性的。
   注意：spec 已把深度整理主要分配给辅形态（01-spec §2 双形态对比"整理资产"列），同时要求主形态可编辑——所以这是产品形态问题而非局部交互问题，已由 **D-0 裁决**（主形态显式整理模式）。
   佐证反面：T0 调用主流程静态预审七维无 fail，问题全部集中在整理域。

2. **字体偏小的根因是合规缺口，不是 token 值。**（source-confirmed）
   全仓 63 处 `font:` 简写整组重声明 vs 仅 **14** 处正确 `composes` typography preset（design-spec §9 硬规则被系统性绕过）。直接调 token 只能影响 14 处。通用按钮 primitive `.btn` 本体 = 12px（`primitives.module.css:287`），10 类可点击元素全在 12-13px。**必须先收敛角色再调 token**——但收敛本身不是零风险机械操作（见批次 C 的 C-0/C-1a/C-1b 拆分）。

3. **响应式是零，不是"局部规则"。**（source-confirmed）
   全项目 0 个宽度 `@media` / 0 个 `@container`（唯一 @media 是配色）。仅两处有降级设计意图（ScenePanel 子阶段网格 auto-fit、MacroGrid wrap）。"编辑器 footer 裁切"根因锁定：`primitives.module.css:435-439` `.editorActions` 无 `flex-wrap`。
   窗口下限问题按 **D-4** 处理：主形态不设 Tauri minWidth（`fit_to_active_monitor` 接管尺寸），以 1024×640 为验收基线 + 面板像素内容下限。

---

## §2 静态任务流预审表（A1，9 条任务 × 七维）

> 证据等级：本表**全部为 source-confirmed**——源码能证明机制存在/缺失，**不能**证明可发现性、犹豫点、焦点连续性与实际完成时间。标注"待真机"的项在 live-confirmed 前不得作为实施依据加码或降级。

维度：入口可发现 / 状态可预期 / 上下文连续 / 操作可逆 / 错误可恢复 / 键盘可完成 / 误触风险。

| 任务 | 步数(静态) | 预审摘要 | 关键证据 |
|---|---|---|---|
| T0 唤起→定位→复制→回工作 | 3-4 | 七维无 fail（可逆 warn 属低风险） | 自动聚焦全选 `SearchBar.tsx:58-75`；剪贴板先于 record，失败不污染 recents `useCopy.ts:30-37` |
| T1 新建提示词 | 4 | 保存成功无 toast（warn）；内容框需 ⌘+Enter（warn） | 常驻 ghost 入口 `ScenePanel.tsx:832`；抛错不清输入 `PhraseFormEditor.tsx:68-73` |
| T2 修改提示词 | 3 | 入口藏 hover 动作簇（warn）；编辑无撤销（fail）；无成功 toast（warn） | 原位替换编辑 `ScenePanel.tsx:798-806` |
| T3 删除提示词 | 3 | 两步 inline confirm + toast（pass）；硬删无恢复（fail，v0.1 按 D-5 维持确认） | `ScenePanel.tsx:906-918`；`phrases.rs:111-117` 物理 DELETE |
| T4 同组排序 | 1/步 | 边界 disabled（pass）；re-pull 后焦点丢失机制存在（warn，**程度待真机**） | `ScenePanel.tsx:920-938` |
| T5 跨 SubStage 移动 | 4 | 入口藏在编辑表单 select（fail），非独立动作 | 唯一入口 `ScenePanel.tsx:1077-1091` |
| T6 跨 Scene 移动 | — | **死路**：编辑器只列当前 Scene 子阶段，属性面板无迁移；workaround=重建+删除，丢 usageCount/lastUsedAt | `phrases.rs:72` 无 scene_id 参数；`promptStore.ts:141-146` 类型无 sceneId |
| T7 连续整理多条 | — | 状态可预期 fail + 上下文连续 fail + 误触 fail（见 §1-1，D-0 已裁决方向） | `ScenePanel.tsx:887` + `commands.rs:157-158`；写操作全量 re-pull 无焦点恢复 `promptStore.ts:730-793`、`useRegionNav.ts:64-65` |
| T8 草稿归档 | 3-5 | 双入口+归档 toast（pass）；**归档后无落地定位**（fail）；丢弃无确认（warn，按 D-5 走撤销状态） | flashTargetId 机制存在却未用于 promote `promptStore.ts:388-414`；丢弃直接执行 `DraftInbox.tsx:100-111` |

---

## §3 分级问题池（合并去重）

### P1 高摩擦（7 条，均 source-confirmed）

| ID | 问题 | 证据 |
|---|---|---|
| A1-01 | 跨 Scene 移动无入口且底层不支持，唯一 workaround 丢失使用历史 | `phrases.rs:72`；`promptStore.ts:141-146`；`ScenePanel.tsx:1085` |
| A1-02 | Scene 看板整卡点击即复制并触发 200ms 无条件窗口隐藏，整理场景高频误触（D-0/D-1/D-2 已裁决方向） | `ScenePanel.tsx:887`；`commands.rs:147-158` |
| A1-03 | 草稿归档后无落地反馈（不跳转/不 flash），不知资产去了哪 | `promptStore.ts:388-414`（flashTargetId 未用） |
| A2-01 | 63 处 `font:` 简写整组重声明绕过 §9（14:63），token 调整无法全站生效 | 明细见 §4 |
| A2-02 | 10 类可点击元素字号 ≤12-13px，根因 `.btn` primitive=12px | `primitives.module.css:287` 及 §4 S1 清单 |
| A3-02 | 通用 `.editorActions` 无 flex-wrap，行内编辑器 footer 窄宽度下按钮被挤出/裁切（**D-6：发布前修**） | `primitives.module.css:435-439`（对照 `ScenePropertiesEditor.module.css:93` 有 wrap） |
| A3-01′ | 窗口尺寸无验证基线（原"补 minWidth"提案被 D-4 否决——主形态走 `fit_to_active_monitor`，改为 1024×640 真机基线 + 面板像素下限） | `tauri.conf.json:14-27`；`lib.rs:24/149/201` |

### P1 candidate（待 live-confirmed 后归级）

| ID | 问题 | 证据 |
|---|---|---|
| A1-05 | Scene 写操作全量 re-pull 无焦点恢复，键盘连续整理断链——**机制 source-confirmed，实际丢失程度待真机**，确认前不得按 P1 实施 | `promptStore.ts:732/738/742/747`；`useRegionNav.ts:64-65` |

### P2 打磨（14 条）

| ID | 问题 | 证据 |
|---|---|---|
| A1-04 | 丢弃草稿无二次确认（D-5：走撤销状态，非加确认） | `DraftInbox.tsx:100-111` |
| A1-06 | 跨 SubStage 移动藏在编辑表单 select，非独立动作 | `ScenePanel.tsx:1077-1091` |
| A1-07 | 新建/编辑保存成功无 toast，反馈弱于删除 | `ScenePanel.tsx:1052-1066` |
| A1-08 | 内容框 ⌘+Enter、名称框 Enter，键盘提交键不一致 | `PhraseFormEditor.tsx:76-92` |
| A1-09 | 跨多位排序需连点单步 ↑↓，每步全量 re-pull | `ScenePanel.tsx:920-938` |
| A1-10 | 编辑/删除/移动按钮藏 hover 动作簇非常驻（**已知-HANDOFF 可发现性裁决**） | `ScenePanel.tsx:920` |
| A1-11 | 删除全部硬删，无撤销/回收站（D-5：v0.1 维持确认，soft-delete 另立项） | `phrases.rs:111-117` |
| A1-12 | DraftInbox composition 按钮被排除箭头导航，焦点序列跳跃（待真机） | `DraftInbox.tsx:183` |
| A2-03 | 16px 标题无 preset 承载（7 处裸写）；`--t-20` 定义了零引用 | `SearchOverlay:29` 等 7 处；`tokens.css:234` |
| A2-04 | 简写内裸行高 `/1`、`/1.6` 未走 `--lh-*` token（token 铁律盲区） | `ScenePanel.module.css:122`、`RecentList.module.css:82` 等 |
| A3-03 | SettingsModal 左 nav 固定 140px 不缩，窄窗布局崩 | `SettingsModal.module.css:33-34` |
| A3-04 | SearchOverlay 固定 2 列永不降级；`.itemMeta flex-shrink:0` 挤压 name | `SearchOverlay.module.css:42/128` |
| A3-05 | `--col-min-substage`(184px) 一值三用（降列阈值/硬 min-width/select），语义冲突需拆分 | `ScenePanel.module.css:285/456`；`AlignmentPhrases.module.css:179` |
| A3-06 | 分栏 minSize 用百分比、内容却是像素硬约束（140/184/200px），窄窗必然打架 | `Dashboard.tsx:78-104` vs 各像素约束 |

### 已知收编（HANDOFF 既有账，不重复计数）

hover 动作簇可发现性裁决（=A1-10）、场景删除入口外露、空态 CTA、toast 单例、Macro 末行 auto-fit 拉伸宽卡、真机复验批次。

### 待真机确认清单（live-confirmed 前挂起）

re-pull 后焦点丢失范围（A1-05）｜删除 confirm 内键盘焦点（T3）｜PhaseBar 极窄裁切｜aside <200px 时 ModifierGrid chip 溢出｜StatusBar 哪个 nowrap 段先被裁｜DraftInbox 焦点跳跃体感（A1-12）。

---

## §4 排版合规数据（A2 全量，source-confirmed）

**违规 S1（可点击+整组重声明+小字号，10 处）**：`.btn`(primitives:287, 12px, 根因)｜`.tab`(ScenePanel:52, 12px)｜`.subStageSelect`(ScenePanel:464, 12px)｜`.segItem`(SettingsModal:171, 12px)｜`.actionBtn`(SettingsModal:335, 12px)｜`.quadBtn`(DraftInbox:116, 12px)｜`.chipName`(AlignmentPhrases:107, 12px)｜`.rowName`(AlignmentPhrases:140, 12px)｜`.phase`(PhaseBar:29, 13px)｜`.navItem`(SettingsModal:57, 13px)。

**违规 S2（其余整组重声明）**：等价 ph-meta 未 compose ×17（RecentList:108、PhaseBar:96、DraftInbox:74/88、ScenePanel:92、SearchOverlay:35/123/129、AlignmentPhrases:28、MacroGrid:109、StatusBar:12、ModifierGrid:72/119、ProtocolBand:50、ScenePropertiesEditor:18、Header:46、Dashboard:53）；等价 ph-card-body ×9（HotkeyBanner:16/34、UpdaterBanner:13、SearchBar:42、SearchOverlay:53/112、RecentList:102、ScenePanel:349、SopProgress:21）；等价 ph-code ×2（AlignmentPhrases:37、SettingsModal:310）；16px 标题裸写 ×7（SearchOverlay:29、SettingsModal:100、ScenePanel:211、primitives:159、Dashboard:105、ErrorBoundary:13）。
63 处按文件分布：SearchOverlay(6)、SettingsModal(7)、ScenePanel(9)、AlignmentPhrases(5)、RecentList(3)、PhaseBar(3)、ModifierGrid(3)、DraftInbox(3)、primitives(4)、Dashboard(2)、HotkeyBanner(2)、UpdaterBanner(2)、ErrorBoundary(2)、SopProgress(2)、Header/Toast/ProtocolBand/ScenePropertiesEditor/MacroGrid/StatusBar/SearchBar 各(1)。

**字号分布**：--t-11×26（meta）/ --t-13×22（正文+2 类可点击）/ --t-12×20（8 类可点击重灾区+code）/ --t-16×7（标题全裸写）/ --t-10×4 / --t-14×2（仅 preset 引用，组件层零直接引用）/ --t-20×0。裸 px 0 处、内联 fontSize 0 处。

**token 现状**：`--t-*` 7 档（tokens.css:230-234, 251-252）；`--lh-*` 仅 tight=1.2/body=1.45（:237-238）；body 基线 --t-13（:353）。13→14 牵连面：preset 层仅 2 处（ph-card-body/ph-empty），22 处 t-13 简写不随动必须手改；撞值风险按 **D-3** 化解：正文 14 后，卡片/区域标题**不升 16**，层级由字重和位置承担，仅 Scene/page title 用 16。

**正确 composes 对照组（14 处）**：SearchOverlay:140、MacroGrid:99、ScenePanel:440/445、primitives:9/49/84/443、Header:42、DraftInbox:24/33/41/66、SearchBar:64。合法单 longhand 覆盖样板：primitives:405 `.input`。

**⚠️ 收敛不是纯机械操作**：preset 同时带字号/字重/行高/tracking/**颜色**，替换简写可能改变计算样式与级联（typography.module.css 头注释明确 cascade caveat：mid-bundle 等 specificity 覆盖不保证生效）；新增 `ph-action`/`ph-page-title` 是设计契约扩充。故批次 C 必须拆 C-0（映射表）→ C-1a（仅完全等价迁移）→ C-1b（新角色+回流）→ C-2（调值）。

---

## §5 响应式/布局约束现状（A3 全量清单，source-confirmed，自包含）

### 总览判定
全前端无整页响应式策略：`src/**/*.css` 仅 1 个 `@media`（`tokens.css:86`，prefers-color-scheme 配色）；0 个 `@container`；0 个宽度断点。收窄全靠 flex/grid 自然挤压 + `min-width:0` + overflow 兜底。`tauri.conf.json:14-27` 无 minWidth/minHeight（仅初始 800×600，:18-19）；主窗口每次唤起走 `fit_to_active_monitor`（`lib.rs:24/75/149/201`），窗口尺寸事实上由显示器决定（D-4 据此否决主形态 minWidth 方案）。

### 布局约束全量清单（按区域）

**全局/窗口层**
- 无 minWidth/minHeight — `src-tauri/tauri.conf.json:14-27`
- 外框内缩 `inset:var(--s-3)` position:fixed — `src/layouts/Dashboard.module.css:9`；外框 `overflow:hidden` — `:15`
- 主形态 flex 列 + `.panorama flex:1 min-height:0` — `Dashboard.module.css:10-11,24`

**左右分栏（唯一用户可调宽度边界，react-resizable-panels v4）**
- task 列 `defaultSize="68%" minSize="42%"` — `src/layouts/Dashboard.tsx:78-83`
- aside 列 `defaultSize="32%" minSize="20%"` — `Dashboard.tsx:99-104`
- 布局持久化 localStorage id `panorama-2col` — `Dashboard.tsx:37-40`
- 分隔条 `width:var(--hairline)` — `Dashboard.module.css:87-91`
- **minSize 是百分比非像素**，窗口越窄实际像素越小，无像素下限

**Scene 看板（唯一有降列设计意图的主区）**
- 子阶段自适应网格 `grid auto-fit, minmax(min(var(--col-min-substage),100%),1fr)` — `ScenePanel.module.css:280-293`（含单列防溢出）
- 列最小宽 `--col-min-substage:184px` — `tokens.css:311`
- Scene tab 轨道 `flex-wrap:nowrap overflow-x:auto` — `ScenePanel.module.css:21-33`
- sticky 列头 `position:sticky top:0 z-index:2` — `:309-319`
- 话术卡动作簇浮层 `position:absolute max-width:calc(100%-var(--s-2))` — `:413-423`
- 话术正文 `-webkit-line-clamp:2` — `:444-452`
- editorSlot 内滚动 `min-height:0 overflow-y:auto` — `:259-263`

**Macro 区**
- strip `flex-wrap:wrap overflow-y:auto max-height:var(--h-macro-strip)` — `MacroGrid.module.css:22-30`
- macro 卡 `flex:1 1 var(--col-min-macro)`(200px) — `:37`；`--h-macro-strip:184px --col-min-macro:200px` — `tokens.css:309-310`
- 卡内动作浮层 `position:absolute` 覆盖 uses 计数 — `MacroGrid.module.css:117-123`

**ProtocolBand（PhaseBar + AlignmentPhrases）**
- band 外缩 margin — `ProtocolBand.module.css:9`
- PhaseBar 阶段 `flex:1` 等分 height:44px **无换行/滚动** — `PhaseBar.module.css:21`
- AlignmentPhrases 横滚 `flex-wrap:nowrap overflow-x:auto height:44px` — `AlignmentPhrases.module.css:5-15`；chip `flex-shrink:0` — `:64`；chipName `max-width:var(--w-chip-max)`(200px) — `:101-109`
- 行内编辑器硬 min-width `flex-shrink:0 min-width:var(--col-min-substage)`(184px) — `:177-180`

**Header**
- brand/logo/gear 全 `flex:0 0 auto` — `Header.module.css:18,32,56`；gear `width:var(--h-quickfind)`(36px) — `:54`
- SearchBar `flex:1 min-width:0` 吸收全部挤压 — `SearchBar.module.css:12,30,36`

**aside（ModifierGrid/RecentList/SopProgress）**
- aside 纵向 `flex-column min-height:0` — `Dashboard.module.css:63-69`
- ModifierGrid `max-height:184px overflow-y:auto` + chips wrap — `ModifierGrid.module.css:39-40,77-81`
- RecentList `min-height:0 overflow-y:auto`，name ellipsis — `RecentList.module.css:23-24,97-100`
- SopProgress `flex-shrink:0`（不收缩，挤压全落 RecentList） — `SopProgress.module.css:6`

**编辑器面板**
- ScenePropertiesEditor footer `flex-wrap:wrap`（防裁切）— `ScenePropertiesEditor.module.css:88-96`；iconRow/swatchRow/chips 均 wrap — `:28,47,83`
- 通用 primitives `.editorActions justify-content:flex-end` **无 wrap** — `primitives.module.css:435-439`

**Modal 层**
- SettingsModal `width:100% max-width:560px max-height:80vh` — `SettingsModal.module.css:16-25`
- 左 nav 固定 `flex:0 0 auto width:var(--w-settings-nav)`(140px) — `:33-34`；右内容 `flex:1 min-width:0 overflow-y:auto` — `:83-89`
- SearchOverlay `position:absolute inset:0 overflow-y:auto` — `SearchOverlay.module.css:5-18`
- SearchOverlay 固定 2 列 `grid-template-columns:repeat(2,minmax(0,1fr))`（永不降级）— `:40-44`；`.itemMeta flex-shrink:0` — `:128`
- Toast `max-width:var(--w-toast-max)`(320px) — `tokens.css:319`

**StatusBar**
- 中段 `flex:1`，多处 `white-space:nowrap` — `StatusBar.module.css:56,20,28,67,91`；绝对定位段 `position:absolute overflow:hidden` — `:83-91`

### 无覆盖区域地图
✅ 有降级规则：Scene 子阶段网格｜Macro 区｜Scene tab 横滚｜话术浮层｜Toast｜ScenePropertiesEditor footer。
🟡 自然挤压无设计意图：Header（挤压全落 SearchBar）｜PhaseBar（极窄裁切待真机）｜aside（SopProgress 不缩，挤压全落 RecentList）。
🔴 溢出/裁切（源码可证）：`.editorActions` 无 wrap｜AlignmentPhrases 行内编辑器硬 min-width 184px 外溢横滚区｜SettingsModal nav 140px 硬撑窄窗崩｜SearchOverlay 固定 2 列不降。
⚪ 待真机：PhaseBar 阶段名裁切｜aside <200px chip 溢出｜StatusBar nowrap 段裁切次序。

### 阈值冲突项
1. `--col-min-substage`(184px) 一值三用、语义不同：降列阈值（可优雅降级，ScenePanel:285）vs 硬 min-width（不缩会溢出，AlignmentPhrases:179）vs select 上下文（ScenePanel:456）——调值同时动降列点和溢出点，需拆 token。
2. footer 换行策略不统一：ScenePropertiesEditor 有 wrap、更广复用的 `.editorActions` 无 wrap。
3. 分栏 minSize 百分比 vs 内容像素硬约束（140/184/200px）两套单位打架，且窗口层无兜底（主形态按 D-4 不设 minWidth，兜底责任移交面板像素下限）。

---

## §6 垂直改进批次（阶段 C 执行方案，按 D-0~D-6 修订）

> 原则：按任务流切片，不按组件。每批交付 = 代码 + 测试（正常/失败/撤销）+ verifier 对抗审查 + 1024×640 基线复验。

### 批次 A「整理模式与操作反馈」（v0.1.0 前）
- **核心：落地 D-0**——主形态显式整理模式：持久化 `interactionMode`（调用态/整理态）；调用态整卡复制+复制即隐藏保持现状；整理态整卡=选择/预览、复制为显式动作、全部写操作窗口驻留（隐藏逻辑按模式判定，`commands.rs` 需感知模式或由前端决定是否触发隐藏路径）
- 随批收口：A1-03（promote 后 flash 定位，flashTargetId 机制已存在）、A1-07（保存 toast）、A1-08（提交键统一）、A1-04（Draft discard 撤销状态，D-5）、A1-12（真机确认后处置）
- 回流：整理模式属产品语义变更 → product-spec §4.0/§4.3 需扩写"模式"契约；是否补 ADR 由 omar 定
- 排除：不动视觉 token、不动布局、不做 Phrase soft-delete

### 批次 B「跨 Scene 移动」（v0.1.0 前，含 ADR-022）
- **推荐独立 `move_phrase` 命令**，不扩展 `update_phrase`（避免移动混入名称/正文覆盖语义）；返回撤销 receipt（原 scene_id / sub_stage_id / order_index），支撑 D-5 短时撤销
- 数据层复杂度**待 ADR 评估，不预判**（receipt+撤销+校验目标 SubStage∈目标 Scene 是新事务语义；现有"目标分区末尾追加+源分区留 gap"模式可参考但不假设够用）
- 交互：分层选择器（移动到… → 选 Scene → 选 SubStage → toast+撤销），不做跨隐藏 Scene 拖拽（与 ADR-021 按钮化一致）
- 随批收口：A1-06（移动升级为独立动作，同一选择器覆盖跨 SubStage）、A1-09（可顺带评估）
- 前置：ADR-022 经 omar Accept

### 发布前零散项（随 A/B 任一批捎带）
- A3-02：`.editorActions` 补 flex-wrap（一行修复 + 窄宽回归）
- 1024×640 真实尺寸基线：真机截图走查，落 live-confirmed 证据，处置"待真机确认清单"

### 批次 C「排版角色收敛」（发布后，四步）
- C-0：生成"旧计算样式 → 目标角色"**映射表**（逐处比对简写与 preset 的 size/weight/lh/tracking/color 五轴，标记完全等价/有偏差）
- C-1a：**只迁移完全等价项**（含 cascade caveat 验证）
- C-1b：新增 `ph-action`（可点击文字）/`ph-page-title`（Scene/page title 16px）角色 + design-spec §9 八步回流；有偏差项归入对应新角色
- C-2：按 D-3 调值（正文 14 / 可点击 ≥13 / 卡片·区域标题不升 16）
- 前置：C-0 映射表经人审后 C-1a 才动手

### 批次 D「响应式底线」（发布后）
- 范围：A3-02 若未随 A/B 完成则并入、A3-03/04（Modal 降级）、A3-05（184px token 按语义拆分）、A3-06（面板像素内容下限，替代窗口 minWidth）+ 真机清单实测闭环
- **不做**：主形态 Tauri minWidth/minHeight（D-4 否决；辅形态窗口落地时单独配置）；整页三档紧凑策略（更大的设计题，本批只堵"会裁切/会崩"的底线）

---

## §7 回流计划

- **D-0 整理模式** → product-spec §4.0（双形态架构）/§4.3（行为契约）扩写"交互模式"；若触及 01-spec §2.3 时间分离表述（"复制后自动隐藏"限定为调用态），spec 为 🧑 人主笔——只提案 diff，不代笔
- 批次 B → ADR-022 正式立项（模板 000-template，含 `move_phrase` 命令设计 + receipt 撤销语义）
- 批次 C-1b/C-2 → design-spec §9 角色表扩充 + tokens 变更走八步
- 批次 D → design-spec 新增"布局底线"节 + product-spec 支持尺寸基线（1024×640）声明
- Phrase soft-delete/restore → 独立立项（D-5 遗留），不混入本轮
