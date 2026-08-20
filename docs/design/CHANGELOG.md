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

## 2026-08-19（三）· 第四段 — P1-a 交叉审查：规则表四处未落地 + 接口契约提前到 P1-a

### 变更内容

两个独立 agent 对上一段（P1-a）做交叉审查，各自命中同一批缺陷。**四条 CRITICAL 不是新决策，是 [[025-unified-anchored-editing]] 子决策 2 的规则表写了但代码没实现**，直接修，未开新 ADR：

- **撤销回来的草稿点外即静默丢弃**（`PhraseFormEditor.tsx`）：dirty 原以「字段种子值」为基准，而撤销 toast 恢复的草稿是**带种子回填**的，于是 `canSave=true` + `dirty=false`，规则表「未改动→直接关闭不发 IPC」分支抢在保存前面。用户按文档说的「点外 = 保存」点出去，既没落库也没提示。修法：新增必填 `mode: "create" | "edit"`，dirty 改以**已落库值**为基准——创建态基准恒为空，无论字段被什么种子填过
- **「拒绝关闭」状态下点另一条铅笔仍丢草稿**（`Editor.tsx`）：`editingId` 是单槽，pointerdown 拒绝关闭后，**同一次按压**的 click 照样落到另一条的铅笔上、改写单槽、卸载刚才拒绝关闭的面板。修法：`onDismiss` 返回 `false` 表示拒绝，`AnchoredEditor` 捕获相位吞掉该次按压的 click——「不关闭」必须意味着这次按压什么都不做（对应 omar 裁决「拒绝期间锁住，不允许切到另一条」）
- **「取消」按钮完全绕过规则表**（`PhraseFormEditor.tsx`）：原 `onClick={onClose}` 直连。同一份脏草稿按 `Esc` 有撤销 toast，点「取消」直接销毁。两个都是放弃入口，现统一走 `handleAbandon`
- **点外触发的保存失败全静音**（`AlignmentPhrases.tsx`）：`handleCreate` / `handleUpdate` 不 catch，`handleSave` 又吞异常。同文件的 delete / move / set-default 全都走 `showError`，只有保存这条没接。点外保存发生在用户视线已经移开之后，静默失败与成功**逐像素相同**。现补 `showError` + 重抛（`onSubmit` 契约写明调用方必须提示后重抛）

**接口契约从 P1-b 提前到本段**（ADR §6 原定「迁移前先定接口契约」，omar 裁决提前堵）：

- `AnchoredEditor` 删 `open` prop——**挂载即打开**。焦点归还写在卸载 teardown 里，`open={false}` 保持挂载会静默吞掉焦点归还
- `PhraseFormEditor` 新增必填 `presentation: "anchored" | "inline"`，取代原先「靠 `anchor` 这个 key 在不在 props 里」选模式——一次 `{...props}` 展开就能凭空得到一个 anchor 为 null 的隐形浮层
- `AnchoredPosition.flipped` 删除（无人消费的死输出；翻转只作为坐标的中间量存在）

### 契约变更（token）

- **`tokens.css` §3b-bis 新增 `--z-modal: 30`**，`--z-popover` / `--z-toast` 顺延为 40 / 50。`SettingsModal` 从 `--z-overlay` 改挂 `--z-modal`。原因：settings 与 search 同踩 `--z-overlay`，相对顺序实际由 `Dashboard.tsx` 的 JSX 顺序决定——今天渲染正确，谁挪一下位置就静默错。**同屏可共存的两层不能同档**。属 [[05-design-spec]] §3c token 契约，随 ADR-025 回流八步一并处理

### 验证

`pnpm test` **357/357**（新增 6 条：撤销草稿点外保存 / 取消走放弃规则 / 保存失败提示 / 拒绝按压锁住 / 拒绝按压逐次重置）· `tsc --noEmit` 0 · `pnpm lint` 0 · `prettier --check` 通过 · `pnpm build` 通过。四条 CRITICAL 的回归测试**已逐条反向验证**：临时还原修复后四条全红，证明测的是缺陷本身而非实现细节。

⚠️ G1 六项真机验收门仍未跑，P1-b 依旧不得开工。

---

## 2026-08-19（三）· 第三段 — ADR-025 P1-a：锚定编辑层落到对齐话术单点

### 变更内容

[[025-unified-anchored-editing]] 分期 **P1-a**（容器单点验证）落地。**只接对齐话术一处**，其余五个编辑面维持在流内 `EditorPanel`，等 G1 真机验收门六项通过后才准迁（ADR §6 分期条款）。

- **`--z-*` 层级标尺**（`tokens.css` 新增 §3b-bis）：`--z-raised` / `--z-overlay` / `--z-popover` / `--z-toast` 四档，按「谁可以盖住谁」排序而非按组件。收编四处各自发明的硬编码——`ScenePanel`(2) / `SearchOverlay`(1) / `SettingsModal`(10) / `Toast`(100)。⚠️ 注释写明 `--z-popover` 在真机 **不起作用**（top layer 元素不参与 z-index），它只服务 jsdom shim 与未来的非 popover 浮层，免得后人误以为是它让浮层浮起来的
- **`AnchoredEditor`**（`primitives/Editor.tsx` 新增）：原生 `popover="manual"` 进 top layer，**不 portal**——DOM 祖先链不变，[[020-restore-protocol-dark-band]] 那 20 个 token remap 靠继承活着
- **`useAnchoredPosition`**（`src/hooks/` 新建）：下方优先 → 空间不足翻上 → 夹取到 **dashboard 矩形**（不是视口，外壳是 `inset: var(--s-3)` 的圆角浮框）→ 观察全部滚动祖先 + resize + 双向 `ResizeObserver`
- **保存语义规则表**（子决策 2 完整落地）：点外+合法+dirty=保存关闭 / 点外+校验不过=**不关闭**并高亮失败字段 / 点外+未改动=直接关不发 IPC / `Esc`=放弃，创建态给撤销 toast 带回草稿原文。dirty 以初值快照比对，不以「是否聚焦过」判定
- 对齐话术编辑时 **chip 不再被替换**——它现在是锚点，必须留在原地
- `AlignmentPhrases.module.css` `.inlineEditor` 随之失去消费者，删除（`--w-inline-editor` 转为浮层 min-width，语义不变）

### 两处 jsdom 验不了、靠读规范抓出来的事

- **`[popover]` 的 UA sheet 声明 `color: CanvasText`，而声明值击败继承值**。ADR-025 选 top layer 正是为了保住 band 的 `--fg-1` remap，但 `color` 不是自定义属性——不显式重声明，浮层会在暗 band 上渲染系统黑字，**恰好是选 top layer 想避免的那个失败**。已在 `.anchoredEditor` 补 `color: var(--fg-1)`。jsdom 完全不带 popover 的 UA 样式表，这条永远测不出来，故 G1 项 1 必须真机验
- **ADR §3 技术约束「jsdom 不支持 popover」经复核属实**（中途一度误判为已支持——当时读到的「原生支持」实为自己刚装上的 shim）。但 shim 需要的**不止 API**：jsdom 带了隐藏闭合 popover 的 UA 规则却无法求值 `:popover-open`，导致规则恒成立、已打开的浮层仍 `display: none`，既不可聚焦也对 role 查询不可见。shim 因此补了 inline `display`（实测只有 inline 样式能压过 UA sheet）

### 验证

`pnpm test` **352/352**（35→37 文件，新增 11 条锚定/规则表 + 6 条定位算术）· `pnpm lint` 0 · `prettier --check .` 通过 · `pnpm build` 通过 · `doc-governance` 0 error / 7 warn（既有基线，`useAnchoredPosition.ts` 前向引用随文件创建自消）。

⚠️ **G1 六项真机验收门未跑，P1-b 不得开工**；jsdom 绿灯不构成 top layer / 继承 / 定位 / 焦点四项的证据。

---

## 2026-08-19（三）· 后半 — 走查缺陷裁决：Scene 下限纠偏 + 承重件标注

### 变更内容

三项走查缺陷逐项裁决（裁决表见 [[026-fixed-spatial-layout]] §2），**只有第 1 项改契约**。

- **Scene 下限 `196px` → `288px`**（`src/layouts/Dashboard.tsx`）。**前一条目把它归为「新设计决策」是判错了**——ADR-026 子决策 2 白纸黑字写着「下限保证 Scene 至少完整显示一个子阶段列」，而 `196px` 实测下 Scene 显示 **0 条话术**。它不是取舍分歧，是**没达到该 ADR 自己写下的验收条件**
  - 新值经实测：区域头 + tab 行 + 卡头（224）+ 第一张话术卡完整（→265）+ 第二张卡露边（→288）
  - **两区下限语义自此一致**——一个完整单元 + 下一个露半截；露出的半截即「下面还有」的提示，故**不引入渐隐或箭头**（不新增视觉语汇）
  - 真机复测：separator 停在 626，Scene = `288px`，首卡完整 + 次卡露边 ✅
  - 连带：挤压阈值由窗口高 `592px` 升至 **`684px`**（常见最小显示器 768px 仍余 84px）。⚠️ 两条常驻横幅同时出现时约 `750px`，与 768 仅差 18px——**再加横幅须重算**
- **`.phase.active::after` 标注为承重件**（`PhaseBar.module.css` 就地注释）：`--brand-dim` 底实测对比度 `1.145:1`，**真正承载活动态的是这条下划线 + 实底序号章 + `--w-600`，底色才是装饰的那个**。不调色阶（会改动整个 band 视觉语言，违反 ADR-025「未新增任何视觉语汇」），改为封死误删路径
  - **这才是本项的价值所在**：CLAUDE §5.1.1 把「删装饰」列为免八步四类之一，而这条下划线**外观上正像装饰**——将来任何人走减法快车道顺手删掉，活动相位当场塌陷且无需任何评审
- **`.separatorRow` 9px 视觉死区记为已知可接受**（`Dashboard.module.css` 就地注释）：不修——扩 hover 需绝对定位 `::before`，其透明带会**吞掉 Macro 末行卡片的点击**；光标是主 affordance 且已覆盖同样 10px。就地留注亦为防止后人重新「发现」并踩进点击吞噬的坑
- 契约回流：[[03-product-spec]] v0.17→**v0.18** / [[05-design-spec]] v0.16→**v0.17** / [[07-features]] v1.12→**v1.13**

### 验证

`pnpm test` 335/335 · `pnpm lint` 0 · `prettier --check .` 通过 · `pnpm build` 通过 · **真机复测 288px 达标**。

---

## 2026-08-19（三）· 前半 — ADR-026 真机走查通过 + 契约回流八步

### 变更内容

- **真机走查三项全过**，`feat/fixed-spatial-layout` 已 `--ff-only` 合入 `main`（`f4bf5fc`）。走查手段：按窗口 ID 定向截图 + 像素行扫描测量 + 合成拖拽至极限
  - **纵向下限实测生效**：拖到底，Macro 停 `133px` / Scene 停 `196px`，与声明值吻合——未复制旧 wake「38% 无下限」那笔债
  - **Separator 命中与光标**：库按 `resizeTargetMinimumSize` 默认 `{coarse: 20, fine: 10}` 把 1px 视觉条撑至鼠标 10px / 触控 20px，hover 态即注入 `ns-resize`
  - **PhaseBar 等宽后活动相位可辨**，识别由下划线 + 实底序号章 + `--w-600` 承担
  - **ADR-026 核心主张拿到直接证据**：切模式前后像素扫描区域边界，三条竖列纵向边界完全相同、横向列分割恒在同一位置——**这正是 jsdom 验不了的部分**
- **两处口径错误订正**（[[026-fixed-spatial-layout]] §2）：
  - 「640px 基线窗口」**不可复现**——主形态窗口恒等于当前显示器尺寸（`src-tauri/src/lib.rs:24` `fit_to_active_monitor` 每次唤起重铺），`tauri.conf.json` 的 `800×600` 仅为占位
  - 起草推算**高估 chrome 约 48px**。实测 `taskGroup = 窗口高 − 263`，640px 时为 `377px` 而非推算的 `424px`；结论不变（`377 > 329`）但余量减半。真正阈值：**窗口高 < 592px 才会挤压**，低于任何现实显示器
- **契约回流八步**（[[03-product-spec]] v0.16→**v0.17** / [[05-design-spec]] v0.15→**v0.16** / [[07-features]] v1.11→**v1.12**）：
  - product-spec §4.0.4 表格重写——原表为 pre-reshape 口径（「中部左侧 60%」「底部左右各 50%」），自 v0.11 起从未回流；§4.0.7 补反设计「模式切换不改区域位置/列宽/尺寸」；§13.2 结构图改纵向分配；§13.3 区域 5/6 位置由「底部左/右」订正为「aside 列中部/底部」；§13.4 Tab 顺序**追认**（本表自始有效，实现层曾颠倒并以「pending human review」挂账）
  - design-spec §10.5 重写——v0.9 的「三列 42/30/28%」与「**全百分比免 px↔% 换算**」两处作废，后者被纵向维度直接证伪；补像素下限警示与实测校准；§10.3 `PanoramaSeparator` 扩为双向变体 + 补记「命中区不等于视觉宽度」
- **`--h-macro-strip` → `--h-modifier-card-max` 改名**（含 `:root.compact` 层 + `ModifierGrid.module.css` 唯一消费者）：取消 Macro 封顶后旧名彻底失真，属 §3c token 契约变更，故走本次八步而非就地补丁——**上条 CHANGELOG 记的「转为 unbound 但未删」在此销账**。顺带订正文档长期写作 `184px` 而 tokens.css 实为 `200px` 的不一致

### 走查发现的三项缺陷（当时未修，**同日裁决完毕，见上一条目**）

当时判为「新设计决策」而未并入回流——后经核实**第 1 项判错了**，它不是取舍分歧，是 ADR 自身验收条件未达成：

1. **Scene `196px` 是结构下限而非可用下限**：压到底时区域内 0 条话术、子阶段行齐腰切断，且 `.phrases` 的 `overflow-y: auto` 被 `scrollbar-width: none` + `::-webkit-scrollbar{display:none}` 抹掉滚动条，**没有任何「下面还有」的提示**。对照 Macro `132px` 给出 1 整行 + 下一行露半截，两个下限质量不对等
2. **Separator 约 9px 视觉死区**：命中区由 JS 撑到 10px，而 `.separatorRow:hover` 的高亮是 CSS 伪类只在真正压中 1px 时触发；库仅挂 `data-separator`、无 hover/active 状态属性可供 CSS 挂钩。表现为「光标已变 `ns-resize`、分隔线却没反应」
3. **`--brand-dim` 底几乎不承担识别**：活动 `(29,36,53)` vs 非活动 `(24,24,27)`，对比度仅 **1.145:1**，远低于 WCAG 1.4.11 非文本 3:1。活动相位识别几乎全押在下划线上，而它 `bottom: calc(-1 * var(--hairline))` 骑在 band 底边框上——一旦被裁剪或遮挡，活动态即塌

### 验证

`pnpm test` 335/335 · `pnpm lint` 0 · `prettier --check .` 通过 · `pnpm build` 通过（合入前跑齐）。token 改名后 335 复跑全绿。

---

## 2026-08-18（二）— ADR-026 Accepted + 当日落地：模式不再重排布局

### 变更内容

- **[[026-fixed-spatial-layout]] `Proposed` → `Accepted`**（omar 当日拍板），代码同批实施
- **`Dashboard.tsx` 删除 `cockpit ?` 条件分支**（-45 行）：两态共用一套空间。区域图固定为——任务列 = Macro 在上 / Scene 在下；aside = Modifier / 最近使用 / SOP。DOM 顺序解析为 §13.4 的 Tab 序列，**三处契约违规归零且未改动任何契约条文**
- **纵向拖拽取代第二套布局**（子决策 2）：左列新增 `Group id="task-2row" orientation="vertical"`，Macro 默认 46% / Scene 54%。2026-08-10 的命中率收益（Macro 不再被 200px cap 砍）由此保住，但不再需要为它保留一整套布局——**二值的「模式」承担不了连续的空间偏好**
- **最小值用像素不用百分比**：Macro min `132px` / Scene min `196px`。旧 wake 的 `max-height: 38%` 无像素下限，窗口一小就退化到约 1 行可见（[[HANDOFF]] 挂账项）；本次是同类问题的第二次出场，**按 ADR §6 要求一并解掉而不是复制它**
- **连带退役**：`.cockpitMain` / `.cockpitRail` / `.modifierTray` / `.macroSlot` 四段 CSS；`ModifierGrid` 的 `dense` prop 与 `.cardDense`（底部 tray 专用变体）；`--macro-strip-cap`（「父容器按态给子组件注入高度」的间接层）
- **持久化键合一**：`panorama-2col` + `cockpit-2col` → `dashboard-2col`，新增 `task-2row`。旧键留在 localStorage 不读不清——纯 UI 偏好读不到即回落默认值，写迁移的成本高于价值
- **测试反向修正**：`App.test.tsx` 两条按模式分别断言 region order 的用例合并为一条 `it.each`，两态断言同一序列；`:205` 的「§13.4 order update pending human review」注释删除。**原测试锁的是应当消失的行为——测试保护偏差，是偏差活得比它的理由更久的方式**
- **两个 token 转为 unbound 但未删**：`--h-modifier-tray`（tray 已移除）、`--h-macro-strip`（仅剩 ModifierGrid 一个消费者，名字已失真）。删 tokens.css 条目属 [[05-design-spec]] §3c 契约变更，命中 CLAUDE §5.1.1 的越界条款，走八步不走快车道

### 验证

`pnpm test` 335/335 · `pnpm lint` 0 · `prettier --check src/` 通过 · `pnpm build` 通过 · doc-governance 0 error。**未验**：像素下限在 640px 基线窗口的表现是推算（panorama 约 452px，扣标记行后余约 424px > 328px），须真机确认；纵向 Separator 的拖拽命中面积与光标反馈同样待走查。

### 变更原因

见同日第一条与 [[026-fixed-spatial-layout]] §3。核心是：dual-layout 从未进过任何决策文档，却越过三处已批准契约——回到契约即可，无需修改契约。

---

## 2026-08-18 — ADR-026 起草（固定空间布局）+ 减法快车道 + ADR status 大小写归一

### 变更内容

- **新增 [[026-fixed-spatial-layout]]（`Proposed`，待 omar 审）**：提议 `interactionMode` 停止驱动区域重排，两态共用一套空间布局。**起因不是审美分歧，是三处契约越界**——(a) [[03-product-spec#4.0.7]] 明写「作用范围：点击语义变更仅限 Scene 话术卡」，实现扩张为整页编排（`Dashboard.tsx:28-36` 注释自陈 "D-0 extended"）；(b) §13.3 区域 6 规定 Modifier 位于「aside 列顶部」，调用态实现为底部通栏 tray；(c) §13.4 Tab 顺序为 Macro/Scene/最近，调用态实现为 Macro/最近/Scene。第三条已被 `App.test.tsx:218` 与 `:239` 两条断言分别固化，其 `:205-206` 注释写着「§13.4 order update pending human review」——**测试在保护偏差本身**
- **溯源结论**：dual-layout **从未进过任何决策文档**。[[023-ui-reshape-before-release]] 只裁「发布前做系统性重塑」与「范围 = UI + 组件架构」，通篇未涉布局形态；`docs/plans/ui-reshape.md` 全文 grep「调用态/整理态/arrangement」零命中。它只存在于一行代码注释里
- **核心置换（子决策 2）**：不是"废掉调用态保留整理态"——2026-08-10 命中率收益（Macro 可见 3.5→8.5 张）只存在于调用态，必须保住。做法是把纵向分配从「按模式二值切换」改为「用户拖拽 + 持久化」，复用 [[016-choose-dnd-and-resizable-layout]] 的 Group/Panel。**二值的"模式"承担不了连续的空间偏好；交给连续控件后，两套布局的存在理由自行消失**
- **CLAUDE.md 新增 §5.1.1 减法快车道**（omar 拍板）：纯删除类 UI 改动（解释性文案 / 装饰 / 未实现占位 / 动效，四类封闭清单）不走方法论 §7 八步，只记 CHANGELOG 一行。四条越界回落条款：删的东西承载语义 / 删 token 条目 / 删区域功能字段 / 一次删三处以上
- **ADR status 大小写归一**：023、024 的 frontmatter `accepted` → `Accepted`，与其余 23 份对齐。doc-governance 未报，但任何按 status 过滤的脚本都会漏掉这两条

### 变更原因

2026-08-17 外部独立前端评价的复盘。评价中经代码核实成立的部分收敛为 ADR-026；**未纳入其主张的「Modifier 标协议层违反 B2」**——经核实不成立，[[020-restore-protocol-dark-band]] §3 已澄清 B2 只管结构分离、不约束标签。§5.1.1 则回应复盘的元结论：八步对新增与删除施加同等仪式成本，使修缺陷比加区域更贵，理性选择就是继续新增。

---

## 2026-08-17 — ADR-025 通过（六条全数）+ P0 落地：PhaseBar 去掉布局漂移

### 变更内容

- **[[025-unified-anchored-editing]] `Proposed` → `Accepted`**（omar 拍板）。**子决策 6 单独点头**——它局部修订 [[024-dark-cockpit-identity]] 已拍板的 PhaseBar 主角化子项，ADR §2 明写「不夹带通过」，故与 1-5 分开确认后才生效。ADR-024 其余身份设计（`--brand` 恒定色系、深色驾驶舱）不变
- **P0 实施**（`src/components/PhaseBar.module.css`）：`.phase.active` 摘掉 `flex-grow: 2.2` 与 `font-size: var(--t-18)`，`.phase` 的 transition 摘掉 `flex-grow` / `font-size` 两项只留 `background-color` / `color`。**切相位不再重排 8 格宽度**，鼠标肌肉记忆位置恒定；动画也不再每帧触发 layout + 文本重排（Linear「永不动画 layout 属性」）
- **权重改由非 layout 手段表达**：活动相位保留 `--brand-dim` 底 + `--brand` 下划线（`::after`）+ 实底序号章 + `--fg-1` + `--w-600`，四项均已存在，无需新增视觉语汇。字号恒定为 `--t-13`；字重仍走 spec §6 的 400/600 语义 ramp（等宽格内不移动格边界）
- **`--t-18` 保留但已无引用方**（`tokens.css:350`），注释改为 `unbound — active-phase display tier retired by ADR-025 §6`。**未删 token**：删 tokens.css 条目属 [[05-design-spec]] §3c 契约变更，须走方法论 §7 八步，不就地补丁

### 变更原因

编辑器裁切缺陷（ADR-025 触发事件 A）与键盘停靠点爆炸（触发事件 B）两根病因已收敛成一份可审决策，本轮拍板放行。P0 与其余五条零依赖、约 10 行 CSS，ADR §6 即定为「今日、独立」，故随拍板同批落地，不被 P1-P3 的编辑体系进度绑架。

### 验证

`pnpm test` 335/335 · `pnpm lint` 0 · `prettier --check` 通过 · doc-governance 0 error。**未验**：等宽后活动相位的醒目度需真机走查确认（jsdom 验不了视觉权重）。

---

## 2026-08-16 — 最近使用去重下沉到 SQL（了结 2026-08-10 的已知取舍）

### 变更内容

- **`list_recent_usage` 在 LIMIT 之前按资产去重**（`repo-core/src/repo.rs`）：加 `ROW_NUMBER() OVER (PARTITION BY target_type, target_id IS NULL, COALESCE(target_id, id) ORDER BY timestamp DESC, id DESC)` + `WHERE rn = 1`，`limit` 从此计的是**不同资产**而非原始行。连拷同一 Macro 40 次不再挤掉其余资产（2026-08-10 记为「已知取舍：单资产刷满取数窗口时 wake 会欠填」的那条，现已消除）
- **NULL 语义是这次的坑**：HANDOFF 原方案写的 `GROUP BY target_type, target_id` 会把所有 `target_id IS NULL` 的行归成一组——composition 用法本就不带 target_id，会被折叠成一条。分区键补 `target_id IS NULL` 判别位，既复刻客户端旧语义，也杜绝真实 target_id 与兜底 record id 撞车
- **客户端去重整条删除**（`prompt/helpers.ts`）：`dedupeRecent` + `RECENT_FETCH_LIMIT` 移除，两处调用点（`loadSlice` / `recordingSlice`）改为直接取 `RECENT_LIMIT`(5) 行并原样渲染。**保留冗余过滤会在 SQL 回归时静默兜底**，与本项目连栽四次的 fail-open 同形，故选单一真相源
- **测试口径迁移** 前端 345 → 335 / Rust 155 → 158：删去 10 条 `dedupeRecent` 单元用例（行为已不在前端），Rust 侧补三条——重复折叠且 LIMIT 计不同资产 / 无 target_id 行不合并 / 跨表同 id 不合并；promptStore 集成块由「recent wake dedupe」改为「recent wake fetch」，改钉两件事：只要 `RECENT_LIMIT` 行、返回什么就渲染什么（重新引入客户端过滤会让它变红）
- **注释订正**：`commands.rs` 的 `RECENT_USAGE_LIMIT_MAX` 说明仍写着「渲染端取 40 行窗口再客户端折叠」，已同步；`repo.rs` 新注释按 `count_today_usage` 既有口径写明全表扫描代价（< 10k 行可接受），并显式禁止「给内层扫描加边界」这种把病灶推远的改法

### 变更原因

2026-08-10 引入客户端去重时即在特征测试里钉了结构解法（SQL 侧去重）。本轮兑现，同时消灭跨语言的双重去重语义。

---

## 2026-08-10 — 调用态空间按命中率重分配（v0.1.1）

### 变更内容

- **动机**：omar 反馈调用态布局不合理。诊断为**面积分配与命中概率倒挂**——Macro（唯一 0 步动作、自带频次排序）被 `--h-macro-strip` 200px 硬 cap 砍掉 40%，需滚动才看得全 13 张；而「最近使用」拿 `flex: 1` 吃掉整列剩余，其中约 400px 是空白。一个唤起即用的界面，高频区需要滚动等于这次调用已失败一半
- **cockpit 纵向翻转**（`Dashboard.module.css`）：`.cockpitMain > :first-child` 由 `flex: 0 0 auto` 改 `flex: 1 1 auto`（Macro 吃满热区），`:last-child` 由 `flex: 1` 改 `flex: 0 0 auto` + `max-height: 38%`（wake 按内容高度钉底）。实测 Macro 可见 3.5 张 → 8.5 张
- **高度归还布局层**（`MacroGrid.module.css`）：`.grid` 的硬 cap 改为 `max-height: var(--macro-strip-cap, none)`，由 `.macroSlot` 在**整理态单独注入** `--h-macro-strip`。同一组件在两态下由父容器决定高度，不再component 内写死；整理态 strip 行为不变（已真机走查确认）
- **滚动边界渐隐**：`.grid` 加 `mask-image` 底部渐隐 + `scroll-padding-block-end`，替代半张卡硬切（旧观感像渲染残缺）。`--h-scroll-fade` 定义为 `var(--s-3_5)` 而非字面量——渐隐带深于 padding 会永久压暗最后一行，绑定 token 使该失配在密度档切换时不可能发生
- **最近使用按资产去重**（`helpers.ts` `dedupeRecent` + `RECENT_FETCH_LIMIT`）：连拷同一 Macro 5 次原本占满 5 条，信息量为零（频次 Macro 卡自己就显示）。改为拉 40 行原始记录、折叠到 5 个**不同**资产。已知取舍：单资产刷满取数窗口时 wake 会欠填（已钉特征测试，结构解法是 SQL 侧 `GROUP BY` 去重）
- **SOP 进度收成单行**：占位区命中率为 0，原 ~180px instrument card 的空间来自其上的活动 Scene。**不删只压**——它是 Tab 六区之一且受「同屏可见」约束（[[02-constitution]] 哲学二 / [[03-product-spec#13.4]]）。连带修复：Scene 空子阶段 03/04 的「添加话术」原被挤出可视区，现完整露出
- **Modifier 托盘横排**：全宽 dock 里象限竖排浪费横向空间，`dense` 变体改为并排（仅 cockpit，整理态 aside 仍竖排）
- **评审修复**（`/review` 三专家并行 + 变异测试）：SopProgress 恢复 `--shadow-1`（surface-1 抬升契约 ADR-018 补遗 P3-3）+ `margin: 0`（无全局 heading reset，flex item margin 不折叠）；`mask-image` 补 `-webkit-` 前缀；`commands.rs` clamp 注释更正（渲染端已从 5 行改为 40 行窗口）；三处注释的事实错误订正
- **测试** 331 → 345：新增 `prompt/__tests__/helpers.test.ts`（去重单元 + 跨表 id + 墓碑不合并 + 边界 + Rust clamp 上界断言）与 promptStore 三条集成用例。集成用例经**变异测试验证有效**——移除两处 `dedupeRecent()` 调用并回退取数宽度会让它们变红（此前 337 全绿）
- **待回流**：[[03-product-spec#13.4]] 描述 SOP 为 instrument card 形态，实现已是单行 stub，随人审八步回流，不就地补丁

### 变更原因

omar 2026-08-10 指出调用态布局不合理。根因不是比例参数，是空间分配未随「唤起即用」的命中概率排序；同时暴露 `--h-macro-strip` 被两态共用这一结构问题。

---

## 2026-07-22 — 紧凑密度档：一屏承载更多资产（结构 token 收紧，字号不动）

### 变更内容

- **代码事实**（分支 `reshape/density-compact`，自 `reshape/ui-v2` 切出）：tokens.css 新增 §3c「Density — compact tier」——`:root.compact` 收紧结构 token（锚点高度 §3a 九项：scene-row 32→28 / phrases 44→36 / region-header 40→32 / macro-tile 56→44 / macro-strip 200→156 / phasebar 44→36 / statusbar 28→24 / quickfind 36→32 / chip 24→22；子网格间距两项：`--s-3_5` 14→12（首版 10，omar 真机反馈 Scene 话术卡拥挤后回调）/ `--s-2_5` 10→8），**字号与行高不动**（密度不牺牲可读性）；4×n 通用间距 scale 不动（承载密度之外的语义）
- **settingsStore** 新增 `density: "comfortable" | "compact"`（默认舒适 = v2 验收基线像素不变），随 theme/accent 同机制走 root 类 + localStorage persist（constitution A2，无需 persist version bump——default merge 补齐旧状态缺失键）；设置 → 外观新增「密度」段控件（舒适/紧凑）
- **新增** `src/styles/density-gate.test.ts`：源级断言 compact 覆盖项必须是 base `:root` 已有 token、必须为严格更小的 px 值、禁触 `--t-*`/`--lh-*`——锁死"越改越大/孤儿覆盖/偷改字号"三类回归；测试 324→330 / lint / prettier / build 全绿
- **话术卡解剖改形**（omar 2026-07-23 追加裁决）：Scene 话术卡静息态**只显标题**，正文预览（原 2 行 line-clamp）从卡面移除——名称即把手，内容仅在整理态整卡点击展开时上屏（D-0 预览语义保留且强化：预览 = 唯一的内容呈现时刻）；承载量提升来自卡片解剖而非只靠间距收紧，此项**不分密度档**生效；涉 product-spec 卡片解剖契约，随八步回流
- **动机**：640px 基线高度中结构佣金（区头 × 6、锚点行高、区块 padding）占比过高，omar 反馈"页面承载内容不够多"；紧凑档实测约省 20% 纵向结构开销
- **待回流**：密度档属 product-spec 外观设置契约 + design-spec token 层，随人审八步回流，不就地补丁

### 变更原因

omar 2026-07-22 反馈一屏资产承载量不足；诊断为结构性开销（非排版松/字号大），以 token 覆盖层最小成本落地，与主题机制同构。

---

## 2026-07-22 — light 主题按驾驶舱语言校准：身份色加深 + 选区可见性 + 主题双轨防漂移门

### 变更内容

- **代码事实**（分支 `reshape/ui-v2`）：tokens.css 新增 §1d「LIGHT-mode identity deepening」——浅色下五路身份色（neutral-violet / blue / green / violet / amber）换用同色相加深锚点（surface-1 白底 ≥4.4:1、作填充压白字 ≥4.4:1，暗色原值 2.2–2.9:1；canvas #f2f2f0 上 blue 4.39 / amber 4.01——仅作填充/焦点环色，不作 canvas 文字色，verifier 实算口径），`--accent`+`--brand` 同步接管（ADR-024 补遗「强调色=身份主题色」在 light 侧闭环）；`::selection` 由 `--surface-3` 直引改为 `--selection` token（浅色下原值对白底 ~1.1:1 几乎不可见，现为品牌色 22% 染色）；`--aux` 元信息灰浅色加深至 ~4.6:1；band token 不动（ADR-020 暗岛恒定，仍用亮 swatch）
- **新增** `src/styles/theme-parity.test.ts`：解析 tokens.css，断言 `:root.light*` 与 `@media` 内 `:root.system*` 两套手工镜像逐 token 相等 + 四个 accent 类均有 light 加深块——锁死双轨漂移；测试 316→324 / lint / prettier / build 全绿
- **待回流**：light 加深色值属 design-spec §2 色板契约，随 v0.15 draft 人审八步一并回流，不就地补丁

### 变更原因

HANDOFF 重塑 v2 余项「light 观感未按驾驶舱语言校」：v2 只调了深色，浅色下身份时刻（logo / 相位主角 / Macro 芯片 / 焦点环）发虚、选中文本不可见。

---

## 2026-07-21 — ADR-024 深色驾驶舱身份：品牌 token + 协议舱主角化 + Macro 命令牌（重塑第二波）

### 变更内容

- **新增** [024-dark-cockpit-identity](../adr/024-dark-cockpit-identity.md)：主形态恒定深色（light 降为显式设置，settingsStore persist v2 迁移一次性重置旧 light 默认）；`--brand`(#8b7bff) 恒定品牌 token 系（独立于用户 accent），用于 logo / 活动相位 / Macro 图标芯片 / 时间线焦点；推翻 ADR-018 补遗"light 为参考观感"锚点
- **代码事实**（分支 `reshape/ui-v2`）：tokens 深化画布 ramp + `--t-15/--t-18` display 层级；PhaseBar 活动相位主角化（18px + flex-grow 2.2 + brand 下划线/序号章）；MacroGrid 命令牌化（56px 高 + 15px/600 名称 + brand 芯片 + hover brand 描边）；RecentList 时间线形态（左轨 + tick 点 + hover brand 点亮）；regionHeaderCount 仪表徽章化；StatusBar 相位点 brand 化；测试 314/314 / lint / prettier / build 全绿
- **背景**：W1–W6 忠实落地既有克制体系后 omar 实机反馈"和原来一样"，授权表现层整体重构（换语言而非调参数）

### 变更原因

克制语言的表现力天花板不满足"优秀水位"；哲学三（时间分离）支持唤起态与桌面的恒定深色分离。

---

## 2026-07-21 — ADR-023 UI 重塑批次 W1–W6：排版角色体系 + 响应式底线 + 动效语言（design-spec v0.15）

### 变更内容

- **新增** [023-ui-reshape-before-release](../adr/023-ui-reshape-before-release.md)：v0.1.0 发布前完成 UI+组件架构系统性重塑（omar 会话内拍板：范围 = UI+架构 / 时机 = 重塑后再发；supersede 审计 D-6 的「批次 C/D 放发布后」排序，D-6 其余仍有效）
- **新增** [ui-reshape](../plans/ui-reshape.md) v1.0：第一性诊断 + 设计北极星 + W1–W7 批次清单
- **修改** [05-design-spec](05-design-spec.md) v0.14 → **v0.15（draft 待人审）**：§9 角色表扩充 5 preset（`ph-page-title`/`ph-action`/`ph-label`/`ph-note`/`ph-num`）；正文层 13→14（审计 D-3）；`ph-code` 12→13；v0.13 随注 3 的 mono 计数分叉由 `ph-num` 收编
- **代码事实**（分支 `reshape/ui-v2`，commits `9161920`/`1fb7b1a`）：全仓 64 处 `font:` 简写清零迁移 composes（原批次 C 四步一次完成，映射即审计 §4）；可点击 12px 根因（`.btn`）修复；UpdaterBanner 失败态降级 StatusBar「更新失败 · 重试」；响应式底线三修（A3-03 SettingsModal nav 可缩 / A3-04 SearchOverlay auto-fit 降列 + itemName min-width / A3-05 token 语义拆分 `--col-min-result`+`--w-inline-editor`）；动效语言（SettingsModal/SearchOverlay 入场 + 全局 prefers-reduced-motion + 唤起路径明确零入场动画守 C1）；测试 309/309 全绿
- **勘误**：审计遗留「暗 band 待复验」实机核验**非 bug**——2026-07-21 早间浅色带截图来自 `/Applications` 旧版实例，dev 版渲染正确（ADR-020 落地无恙）

### 变更原因

omar 真机反馈「体验/视觉不佳、改动零散」，ADR-023 决议以一次连贯重塑替代销账式补丁；W1–W6 为第一落地波（W4 组件架构并行进行中）。

---

## 2026-07-12 — ADR-022 落地：批次 B 跨 Scene 话术移动（product-spec v0.16 / features v1.11）

### 变更内容

- **修改** [03-product-spec](03-product-spec.md) v0.15 → **v0.16**：§13.3 区域 4 内容层动作簇契约更新——「移动到…」分层选择器（目标 Scene → 子阶段/未分组，同目标确认禁用防空移动）+ 撤销 toast（MoveReceipt 反向恢复精确排序位，仅 toast 生命周期）；**双路径语义等价显式记档**（编辑器子阶段下拉保留可写，ADR-022 子决策 2 的代价条款兑现）；移动不计 usage；修订记录补 v0.15/v0.16 两节（v0.15 当日漏记，补账）
- **修改** [07-features](07-features.md) v1.10 → **v1.11**：新增 §3.14 UX 任务流批次 B（1 功能 `done`）；§4 节奏表加批次 B 行，合计 85→86
- **代码事实**（分支 `feat/cross-scene-move-batch-b`，executor 4 commit + P2 修复）：repo-write `move_phrase` 单事务（校验 phrase 存在 + target SubStage∈target Scene，外来 Scene 子阶段仅靠 FK 拦不住、显式 SELECT 校验）+ MoveReceipt；IPC 注册过 ipc-contract 三方 gate；promptStore `movePhrase` action；ScenePanel「移动到…」选择器 + `showWithAction` 撤销。verifier 对抗审查 **PASS**（独立复跑七项门禁全绿；唯一 P2「空移动挪到分区末尾」已随批修复：同目标确认禁用）；真机移动/撤销视觉链路待验

### 变更原因

ADR-022 Accepted 当日落地批次 B：T6 跨 Scene 移动死路打通且零 usage 历史损失（审计 A1-01 P1 + A1-06 P2 同批收口），D-6 排期要求 v0.1.0 前完成。

---

## 2026-07-12 — UX 任务流审计批次 A 回流：交互模式契约（product-spec v0.15 / features v1.10；ADR-022 Accepted）

### 变更内容

- **修改** [03-product-spec](03-product-spec.md) v0.14 → **v0.15**：§4.0.2 退出语义加「调用态」限定（整理态复制不隐藏）；**新增 §4.0.7 交互模式契约**（调用态/整理态两态语义表 + ModeToggle 控件形态 + interactionMode 持久化 + 作用范围仅限 Scene 话术卡 + 反设计两条；整理态复制 **usage 照计**——隐藏与使用统计解耦，omar 确认）；§4.0.4 差异点与 §4.0.5「只有主形态做的事」同步加限定；§4.0.5 加边界注「主形态整理态承接轻量整理，批量/结构性整理仍归辅形态」；§4.3 频率表加整理态行；§4.4 补批次 A 三条新反馈（保存成功 toast / discard 可撤销 / promote 落地 flash）
- **修改** [07-features](07-features.md) v1.9 → **v1.10**：新增 §3.13 UX 任务流批次 A（6 功能 `done`）；§4 节奏表加批次 A 行，合计 79→85（附带修正 2026-07-06 漏更的合计 78→79）
- **修改** [ADR-022](../adr/022-cross-scene-phrase-move.md) Proposed → **Accepted**（omar，2026-07-12）：独立 `move_phrase` + MoveReceipt 撤销 + 分层选择器；**子决策 2 勾选「保留双路径」**（编辑表单子阶段下拉维持可用，product-spec 移动契约须写明两径语义等价）——批次 B 就此解锁
- **修改** [01-spec](01-spec.md) v0.6 → **v0.7**：§2.3 时间分离表退出动作「复制后自动隐藏」加「（调用态）」限定——人主笔文档，omar 明确授权后代笔（2026-07-12），仅此两字、无其他改动
- **代码事实**：批次 A 分支 rebase 整理后合入 main（merge `53e34a2`，10 commit：`6f91a35` 拆出 docs 独立提交、`.codex/`+`AGENTS.md` 从历史剔除、原摘除提交 drop；重建链尖与 verifier PASS 树逐字节一致，门禁结论不失效）

### 变更原因

D-0 整理模式已在代码落地（2026-07-12 批次 A，verifier PASS），按方法论 §7 八步把「调用态/整理态」从实现事实回流为纸面契约，防 spec 与代码漂移；ADR-022 Accept 是批次 B（跨 Scene 移动）的启动门。

---

## 2026-07-06 — ADR-021 涟漪：Scene 编辑分层化（废除全局编辑态；product-spec v0.14 / design-spec v0.14 / features v1.9）

### 变更内容

- **新增** [ADR-021](../adr/021-scene-layered-editing.md)（Accepted，2026-07-06 omar 拍板）：废除 ScenePanel 全局 editMode，拆属性/结构/内容三层就地编辑。子决策 1「排序拖拽→按钮」（视图网格 copy 主动作与拖拽 affordance 互斥，SubStage dnd 移除、←→/↑↓ 等价承接，[ADR-016](../adr/016-choose-dnd-and-resizable-layout.md) dnd 范围收缩至 MacroGrid/AlignmentPhrases）；子决策 2「scene.color 定性用户内容色」**待 omar 复核**（否决降级仅存储，隔离两处 inline style 可回退）
- **修改** [03-product-spec](03-product-spec.md) v0.13 → **v0.14**：§13.3 区域 4「管理话术」「管理结构」统一编辑态契约整体推翻，重写为三层就地编辑契约（属性面板字段规格 / 列头与话术卡动作簇 / ghost 入口 / `stopPropagation` 守 copy / 排序按钮化）；尺寸行「编辑态保留纵向行」删除、空子阶段列常显；顶部 Tab 补「＋ 新建场景」（创建即开属性面板）；属性面板不进漫游序列显式记档
- **修改** [05-design-spec](05-design-spec.md) v0.13 → **v0.14**：§12.4 新增「用户内容色」条目（scene.color 只染场景自身图标 glyph 不染 chrome，6 色预设 hex 组件内常量不入 token 表，与 ADR-019 边界厘清 + 回退协议）；修订记录补就地动作簇 hover+`:focus-within` 双通道 reveal 与 ghost 形态
- **修改** [07-features](07-features.md) v1.8 → **v1.9**：§3.8 新增「Scene 编辑分层化」`done` 行 + 谱系注记（推翻 v1.4/v1.6/排序 UI 三行的编辑态 UI 承载，能力零回退，旧行保留作历史）；§4 节奏表加 2026-07-06 行，合计 78→79 项
- **代码事实**（plan [scene-layered-editing](../plans/scene-layered-editing.md) 9 任务全数收口）：新增 `ScenePropertiesEditor.tsx`（+18 用例）+ `sceneIcons.ts`/`SceneIcon.tsx` 抽共享；`ScenePanel.tsx` 1706→949 行；前端 181→222 测试全绿（12 格实体×CRUD 矩阵 + 异步失败路径 + draftsActive 重置 + 键盘可达），cargo --workspace / lint / prettier / build / doc-governance 全过；两轮 verifier 对抗审查 PASS

### 变更原因

用户反馈「Scene 只有一个编辑态、过于抽象」；摸底证实 editMode 实为改名器，PRD §6.4 已承诺的 icon/color/rolePresets 零 UI 承载。走方法论 §7 八步回流（锁 diff → 影响半径 → 上游一致性 → bump → 涟漪 → features 回写 → ADR → AI 层同步），不就地补丁。

---

## 2026-07-02 — 文档体系缺口审计清账批次（元数据卫生 + doc-governance gate + sitemap/test-spec 重写 + CLAUDE.md §7 沉降；MANIFEST v1.9）

### 变更内容

- **新增** doc-governance 引用契约 gate（第 4 个源码级 gate，与 token-gate / b2-separation / ipc-contract 并列）：vendored checker `scripts/doc-governance/{index,checks}.mjs`（上游 ai-dev-lifecycle content-os v0.1，零网络/零 LLM）+ 项目契约 `doc-governance.config.mjs`（三层分级：authoritative=error 挡门 / working=warn / frozen=skip）+ Vitest gate `scripts/doc-governance/doc-refs-gate.test.ts`（随 `pnpm test` 与 CI frontend job 执行，附扫描数 >20 反空转护卫）；`.prettierignore` 豁免 vendored 两文件
- **修改** [MANIFEST](../MANIFEST.md) v1.8 → **v1.9**（元数据卫生）：§9 实施方案 3 → 6（补录 asset-editing-and-adaptive-layout / scene-phrase-editing / scene-substage-editing 三份已收口 plan 并标注状态）；新增 §11.7 技术调研层（`docs/research/` 索引 + resizable-panels 调研）；§8 ADR 计数 19 → 20 + 011 行转 Reserved 占位；本批二次改动：§4/§5 sitemap·test-spec 行同步 draft v0.2
- **修改** plans frontmatter 治理：[scene-phrase-editing](../plans/scene-phrase-editing.md) / [scene-substage-editing](../plans/scene-substage-editing.md) 补齐 frontmatter（type/status/description）；[prompt-hub-mvp](../plans/prompt-hub-mvp.md) status `pre-code` → `active`、[mcp-write-pipeline](../plans/mcp-write-pipeline.md) status `pre-code` → `done`（与收口事实对齐）
- **修改** ADR 生命周期字段：[ADR-005](../adr/005-prompt-combiner-reuse.md) 补 Last reviewed + 复议条件（防 Proposed 无限漂）；**新增** [ADR-011](../adr/011-search-usagesource.md) Reserved 占位文件落盘（此前编号仅存在于 MANIFEST 表格）；[ADR-012](../adr/012-lock-visual-quality-anchor.md) frontmatter status 补同步 `Superseded`（2026-06-26 正文已改，frontmatter 漏同步）；[ADR-017](../adr/017-enable-auto-update.md) status 规范化 `accepted` → `Accepted`
- **修改** 死路径修复 + frontmatter description 瘦身：[05-design-spec](05-design-spec.md) §12.3 seed 路径 `src-tauri/migrations/` → `src-tauri/crates/repo-core/migrations/`（workspace 拆分后旧路径失效）；[07-features](07-features.md) §4「自动同步约定」改「手动同步」（`scripts/update-features.sh` 从未落地）；03/05/06/07/09 五份 frontmatter description 从逐版本编年史瘦身为「一句定位 + 召回时机」，版本叙事统一指向本 CHANGELOG（温区召回精准度治理）
- **修改** [08-sitemap](08-sitemap.md) v0.1 → **v0.2 全量重写（draft，待 omar 人审）**：v0.1「13 视图清单」已整体失真，重写为「单窗口一屏全景 + 浮层」模型——§1 资产对象树（补 UI 承载注记）/ §2 区域地图 / §3 浮层与模式 / §4 双形态唤起路径 / §5 焦点导航（Tab cycle 6 区）/ §6 视图跳转图 / §8 旧视图去向对照表；对齐 product-spec v0.13 现状
- **修改** [11-test-spec](11-test-spec.md) v0.1 → **v0.2（draft，待人审）**：从 pre-code 四层金字塔规划改写为实际测试盘面——前端 Vitest 154 用例/17 文件 + Rust workspace 135 用例 + 4 源码级 gate（§3，含本批落地的 doc-governance gate）+ CI 双 job（§7.1）+ C1 bench gate（§5）；引入 📊 实测 / 🎯 目标 / ⚠️ 红线 三标注，Playwright E2E 未落地如实标注（真机验收 runbook 临时顶位）
- **修改** [CLAUDE](../../CLAUDE.md) §7 纠错 + 沉降：版本指针纠错（文档体系行 product-spec/design-spec/features/prd 同步至 v0.13/v0.13/v1.8/v0.12，MANIFEST v1.8 → v1.9）；八条编年史长段落沉降为指针形式（事实明细下沉 CHANGELOG 日期条目 / ADR / features §4 节奏表 / HANDOFF），§3 温区/冷区条目补版本号

### 变更原因

文档体系缺口审计（2026-07-02）暴露四层锈蚀：① 元数据层——MANIFEST 漏登 3 份已收口 plan 与整个 research 层、plans status 停在 `pre-code` 与收口事实矛盾、ADR frontmatter 状态漂移（012 正文 Superseded 而 frontmatter 仍 Accepted）、frontmatter description 逐版本滚雪球挤占温区召回位；② 执行层——文档引用契约（双链/相对链接/code-path）无任何 gate，死路径静默腐烂（design-spec seed 路径在 workspace 拆分后失效近月无人察觉）；③ 内容层——sitemap/test-spec 两份 AI 主笔文档停在 pre-code v0.1，与实现现状脱节最重；④ 入口层——CLAUDE.md §7 版本指针失真且编年史膨胀，违背「指针不承载事实明细」的分工。本批为一次性清账：A2 修元数据、B2 加第 4 个源码级 gate 阻止引用契约复锈、C1/C2 重写两份失真文档（🤖 AI 主笔按 §5.2 保持 draft 待 omar 人审）、C3 把 §7 沉降为纯指针。验证：`pnpm test` 154/154（17 文件，含新 gate）+ lint + prettier + build 全绿（Rust 侧未动）。

**人审记录（2026-07-02）**：08-sitemap v0.2 / 11-test-spec v0.2 经 omar 审阅通过，draft → ratified。

---

## 2026-07-01 — 产品走查修缮批次收口（P0 止血 + P2 质量闸门 + P3 生命周期/设计稿对齐；ADR-020 暗 band；design-spec v0.13 / product-spec v0.13 / features v1.8 / prd v0.12）

### 变更内容

- **新增** [ADR-020](../adr/020-restore-protocol-dark-band.md)（`Accepted` 2026-07-01）：恢复协议层暗色 band——调和 ADR-018（吸收 Promptscape 暗 band）与 ADR-019（全面中性化）的实现冲突；新增 `--band-*` 层级固定色 token 族（双主题恒定深底浅字 + band-safe accent 别名），band 作用域整体重映射中性 token 使 PhaseBar/AlignmentPhrases 等子组件零改动可读；澄清「层级固定色（染容器/位置）≠ ADR-019 废除的语义色（染资产类型）」本体论；同批层级编码修缮（ModifierGrid 补「协议层 · 参考」pill / RecentList「对齐话术」徽标撤 `--accent` 实底转中性描边）
- **修改** [05-design-spec](05-design-spec.md) v0.12 → **v0.13**：§2.4.2 light neutral scale 明度重绘（muted 灰 canvas `#F2F2F0` + 纯白 surface-1 抬升面 + surface-2/3 翻转为递进 muted 填充）；新增 §2.4.5 `--band-*` token 契约；§6 PhaseBar 字重实装归位注记；§8.2.1 elevation 落地契约（`--shadow-1` 语义扩展为 resting + hover lift、新增 `--lift-1` 位移 token 契约、`--shadow-2` 仅 overlay/popover）；§9 标注 7 个 `.ph-*` preset 已落地 `src/styles/typography.module.css`（composes 引用 + 加倍类名覆盖 caveat + Input color 例外 + mono 分叉登记）；§10.1 focus outline-offset 分类规则（region 内缩 / 行内 `--hairline` 或 0）；§10.2 EmptyState 富空态插槽 + Chip transparent 底/`--w-chip-max` 截断；§10.3 更新 MacroGrid（图标盒全量 accent + hot Flame 实心）/ ScenePanel（auto-fit + 「未分组」列头）/ RecentList（卡容器 + 徽标中性化）并新增 ModifierGrid（aside chip 参考面）/ Toast 行；§10.4.3 preview 口径校正 ≤80 字符 + DraftCard「编辑」动作 + composition promote 暂缓；§10.6 ModifierGrid 范式改判 Card → Chip 行（消除两张皮）；§10.7 新增 intent=accent + primary 文字色 `--fg-1` hard rule；§10.8.2 ProtocolBand 重写为暗 band；§11 Toast intent 分级契约（success 800ms / error 4000ms amber + role=alert）；§12.3 icon 清单更新；§13.1 两处层级编码修缮注记
- **修改** [03-product-spec](03-product-spec.md) v0.12 → **v0.13**：§13.2 aside 列补 Modifier 参考面节点；§13.3 区域 2-bis 加「设为默认」（Star → `set_default_alignment_phrase`）；区域 4 视图态 auto-fit + 「未分组」列头、草稿卡动作 2→3（补「编辑」：`get_draft` 水合 → `update_draft`）、composition promote/编辑暂缓止血（disabled +「该类型暂无 UI 承载」，discard 可用）、「管理结构」排序落地 UI（SubStage 拖拽 + Scene 前移/后移）；新增「aside 补充：Modifier 原子库参考面」契约（四象限 chip 复制不记 usage + 层标记 + hover 最小管理簇 + 无 UI 新建入口，非 Tab region）；区域 9 更新页补检查失败 auto/manual 分级（触 ADR-017 交互记载）
- **修改** [07-features](07-features.md) v1.7 → **v1.8**：新增 §3.12 产品走查修缮批次——12 功能 → `done`（Draft 促升前编辑 / composition 暂缓 / Modifier 管理簇 / 设为默认 / Scene·SubStage 排序 / Toast 分级+复制失败可见 / 更新失败分级+重试 / 启动 DB 兜底 / 暗 band / light 重绘 / auto-fit 全景 / 像素对齐包）+ 7 项质量/治理不计数（测试 CI `ci.yml` / B2 源码 gate 恢复 / IPC 三方契约 gate / preset 落地+token 收敛 / primary 对比度修复 / focus 补齐 / bench C1 退出码）；§4 节奏表加行，合计 66→78
- **修改** [06-prd](06-prd.md) v0.11 → **v0.12**：§10.0/§10.3 Tauri IPC 5→6（新增 `get_draft` UI 水合）；`promote_draft` 行补 composition promote 暂缓注记；§10.3 注/§6.6/§6.1 资产管理命令补记（`set_default_alignment_phrase` + `update_modifier` 可选 `group_kind`）；preview 口径 ≤100 字→≤80 字符（代码口径）；§6.1 登记 `delete_modifier` hard-DELETE 与 soft-delete 表述的既有 drift（待裁定）
- **新增代码**（本批已全绿落地，见各文档引用）：前端 `useCopy`/`toastStore`/`Toast` intent 分级、`DraftInbox` 编辑态+暂缓、`ModifierGrid` 管理簇、`AlignmentPhrases` Star、`ScenePanel` auto-fit/未分组/排序、`typography.module.css`、`tokens.css`（light 重绘 + `--band-*` + `--lift-1` + `--w-chip-max`）、`b2-separation.test.ts`、`ipc-contract.test.ts`、`.github/workflows/ci.yml`；后端 `commands.rs`（`get_draft`/`set_default_alignment_phrase`/`update_modifier` group_kind）、`repo-write`（modifiers/alignment_phrases）、`lib.rs` 启动 panic 兜底、`bench/hotkey-wake.bench.mjs` C1 退出码

### 变更原因

2026-07-01 产品走查（按「实体×CRUD 覆盖矩阵反查写命令」方法）暴露三层问题：① 可用性/可靠性 P0（primary 按钮暗色下不可读、复制失败静默、composition promote 产孤儿数据、启动 DB 失败无声消失、auto 更新失败常驻横幅）；② 质量闸门缺失 P2（无 CI、B2 源码 gate 随组件下架丢失、IPC 三方无契约测试）；③ 资产生命周期死端与设计稿偏差 P3（draft 促升前不可编辑、Modifier 象限选错不可救、默认话术不可换、Scene/SubStage 不可排序、协议层暗 band 在 ADR-019 中性化时被误抹平、light 主题未按设计稿重绘、preset 从未落地）。修缮批次分 P0/P2/P3 并行落地并全绿（前端 151 测试 / cargo --workspace / lint / prettier / build），本批按方法论 §7 一次性把代码事实回流 5 份文档（每份一次 bump 到位），暗 band 以 ADR-020 为上游锚点。真机视觉复核与 bench 回归为遗留待办。

---

## 2026-06-27 — Scene/SubStage 结构编辑收口（补 scene-phrase-editing 当初 defer 的死维度，features v1.6 / product-spec v0.11 / prd v0.11）

### 变更内容

- **新增** [docs/plans/scene-substage-editing.md](../plans/scene-substage-editing.md)：锁定决策 D1–D4（Scene+SubStage CRUD 一起做 / seed `0011` 灌示范 SubStage / Tauri-only 不上 MCP / 删非空 Scene 阻止·删 SubStage 解绑 Phrase），无 schema migration（表已存于 `0001`，唯一 migration 是纯 seed `0011`，user_version 10→11）
- **修改** [07-features](07-features.md) v1.5 → **v1.6**：§3.8 新增「Scene/SubStage 结构编辑」→ `done`（后端 74 / 前端 109 全绿，真机 CRUD 落盘待验）；§4 节奏表加结构编辑行，合计 65→66 项
- **修改** [03-product-spec](03-product-spec.md) v0.10 → **v0.11**：§13.3 区域 4 加「管理结构（编辑模式）」契约——编辑态 Scene 头部下方「结构编辑器」inset 承 Scene 容器改名/删/新建 + SubStage 增改名删（含空子阶段可见）
- **修改** [06-prd](06-prd.md) v0.10 → **v0.11**：§6.4 加「写入口归属（创建入口指派）」——明确 Scene/SubStage 增改删排由 UI 编辑态承载（Tauri-only），补此前 defer 留下的死维度
- **新增代码** `src-tauri/crates/repo-write/src/{scenes,sub_stages}.rs`（各 CRUD+reorder + 19 单测）；8 IPC（`commands.rs` + `lib.rs` 注册）；`migrations/0011_seed_sub_stages.sql`；前端 `ipc/index.ts` +8 / `promptStore` +8 actions + 5 测试 / `ScenePanel` 编辑态结构编辑器 + 6 组件测试

### 变更原因

产品走查（2026-06-27）发现：`scenes` / `sub_stages` 两表有 schema + 读路径 + Phrase 的 `sub_stage_id` FK，但**无任何写命令、无种子**——Scene 容器不可编辑、SubStage 永远 `[]`（死维度），ScenePanel 编辑态的子阶段下拉永远只有「无分组」。根因是 [[scene-phrase-editing#13]] 有意只做 Phrase 编辑、defer 结构编辑，留下 UI 死端。本次收尾补齐。契约现成（PRD §6.4 已定字段+FK+删除语义），不开新 ADR；不违 [[01-spec#8.4]]（§8.4 只禁嵌套子 Scene，SubStage 是同级分组）。

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
