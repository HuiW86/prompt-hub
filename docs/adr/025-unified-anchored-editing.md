---
type: adr
project: prompt-hub
status: Accepted
description: 编辑体系统一——编辑器脱离宿主文档流改锚定 top layer；organize 升级为选择驱动的键盘处理模式（动作退出导航序列、直接按键、保存即推进）；附带复核 ADR-024 PhaseBar 主角化的布局漂移
---

# ADR-025: 统一锚定编辑层 + 键盘动作层

## 1. 标题与日期

- **标题**：编辑器从「内联进宿主文档流」改为「锚定在宿主上的 top layer 浮层」；organize 从「带按钮的浏览模式」升级为「选择驱动的键盘处理模式」
- **日期**：2026-08-14（2026-08-16 两轮复核后重写；2026-08-17 omar 拍板）
- **决策者**：omar（2026-08-17 通过，含子决策 6 单独点头）；起草：Claude（🤝 共创文档，见 [[CLAUDE#§5.2]]）
- **影响范围**：
  - **代码**：`primitives/Editor.tsx`（新增 `AnchoredEditor` 壳）/ `PhraseFormEditor.tsx` / `hooks/useRegionNav.ts`（新增动作键层）/ `AlignmentPhrases.tsx` / `scene/ViewPhraseCard.tsx` + `scene/ViewColumn.tsx` + `scene/ScenePanel.tsx` / `MacroGrid.tsx` / `ScenePropertiesEditor.tsx` / `DraftInbox.tsx` / `RecentList.tsx` / `SearchOverlay.tsx` / `PhaseBar.module.css` / `tokens.css`（新增 `--z-*` 层级标尺）
  - **文档**：[[03-product-spec#13.3]] 各区域编辑契约 + [[03-product-spec#13.4]] 键盘契约 / [[05-design-spec]] overlay 层级 + 选中态规范 / [[07-features#3.8]] / [[11-test-spec]]
  - **ADR**：修订 [[021-scene-layered-editing]] 的**落地形态**（就地原则不变，动作簇从 hover-reveal 改为选中态跟随）；复核 [[024-dark-cockpit-identity]] 的 PhaseBar 子项（见子决策 6）。**不扩展** [[022-cross-scene-phrase-move]] 的 Receipt 模式（见子决策 5）

## 2. Status

`Accepted`（2026-08-14 起草；2026-08-16 经外部对抗审查 + 第一性原理复核两轮重写；**2026-08-17 omar 拍板通过，六条子决策全数采纳**）

> 子决策 6（PhaseBar 主角化复核）**推翻 ADR-024 已拍板的一个子项**，故未夹带通过，2026-08-17 由 omar 单独点头后生效。[[024-dark-cockpit-identity]] 的 PhaseBar 子项自此被本 ADR 局部修订，其余身份设计（`--brand` 恒定色系、深色驾驶舱）不变。
>
> **落地进度**：P0（子决策 6）已实施 2026-08-17 —— `PhaseBar.module.css` 摘除 `flex-grow: 2.2` / `font-size: var(--t-18)` 及两者的 transition，活动相位改由 `--brand-dim` 底 + `--brand` 下划线 + 实底序号章 + `--w-600` 表达权重，格宽与字号恒定。
>
> **P1-a 已实施 2026-08-19**（`--z-*` 标尺 + `AnchoredEditor` + `useAnchoredPosition`，只接对齐话术一处）。当日交叉审查发现**子决策 2 的规则表有四处写了没落地**（撤销草稿点外静默丢弃 / 拒绝关闭期间被同一次按压绕过 / 「取消」按钮不走规则表 / 点外保存失败静音），已当日修复并补回归测试，不构成新决策。同时按 omar 裁决把 ADR §6 原定 P1-b 的**接口契约定义提前到 P1-a**（`AnchoredEditor` 删 `open`、`PhraseFormEditor` 新增必填 `presentation`、`AnchoredPosition.flipped` 删除），避免五个编辑面照着有陷阱的接口迁一遍。明细见 [[CHANGELOG]] 2026-08-19 第三、四段。
>
> **G1 走查已于 2026-08-19 执行**：项 1/3/4 omar 目视通过、项 6 实测通过、项 2/5 deferred 到 P1-b 门（明细与理由见 §6 走查结果表）。**omar 拍板 P1-b 可开工**，代价是滚动跟随那条链路带着零覆盖进入迁移。P2–P3 待排。

### 修订记录

**第一轮 · 2026-08-16 外部对抗审查（codex，独立模型）**

| 子决策 | 起草稿 | 修订后 | 依据 |
|---|---|---|---|
| 定位实现 | 用 `position: fixed`，因 jsdom 不支持而否决原生 `popover` | **改用原生 `popover`（top layer）+ 约 20 行 jsdom shim** | 用测试环境成本否决平台能力，方向反了；top layer 顺带解掉 transform 包含块陷阱 |
| 删除语义 | DeleteReceipt + 撤销 toast 替代确认框 | **撤回，维持现有确认框** | 该方案正是 [[022-cross-scene-phrase-move]] 否决的 Option C（丢 id / created_at / usage 历史，`022:57`） |

同时修正的事实错误：运行时依赖数（6 → 11 条声明 / 7 条非 Tauri）、PhaseBar transition 行号（补 `:45-49`）、"约 80%" 无依据改为可数口径、补锚点自身位于滚动容器的约束、补保存语义的 dirty / 校验失败规则表。

审查提出但**经核实驳回**的两条：(a) 称 ADR 把 `overflow: hidden` 错记在 chip 行上——原文归属正确，写的是外层 `ProtocolBand`；(b) 称 hover-lift 五文件清单未经证实——五处均已逐文件 grep 核实并标注行号，审查方因未获授权读取其中三个文件而误判。

**第二轮 · 2026-08-16 第一性原理复核（决策者驳回"瘦身"提案后重写）**

| 变更 | 内容 | 依据 |
|---|---|---|
| **删除并发协议** | 撤回第一轮补入的 op id / 乱序丢弃 / 增量回滚，改为一行规则「失败即 `list_*` 重拉」 | `reorder_*` 传完整有序 id 列表（`commands.rs:472`）、`set_default_alignment_phrase` 传 `(phase_id, id)`——**全是绝对状态幂等写入**，last-write-wins 本身就是正确语义，协议防的是不存在的问题 |
| **新增子决策 3「键盘动作层」** | organize 从"带按钮的浏览"升级为"选择驱动的处理模式" | 实测证据：动作按钮全部混入 arrow 导航序列，键盘可用性系统性受损（见 §3） |
| **撤销 side peek 侧栏** | 被子决策 3 的连续处理模型取代，不是砍掉 | 侧栏解决"看得见详情"，真正的痛点是"逐条往返"；连续处理在结构上更简单（无第二布局分支 / 无嵌套滚动）且吞吐量高一个数量级 |
| **补搜索→编辑、模板化空状态** | 调研已收敛但起草时遗漏的两条 | Raycast「列表即管理界面」「模板优先于空表单」 |

第一轮后曾提出一版"瘦身"方案（砍侧栏、缩范围至 3 天），**被决策者驳回**：目标函数应是「优秀的使用工具」而非「最小不坏」。低频 + 高摩擦恰恰是让工具显得业余的时刻。本轮据此重写。

## 3. Context

### 触发事件 A：编辑器被物理裁切（功能缺陷）

`PhraseFormEditor`（名称输入 + 3 行 textarea + 取消/保存，实高约 150px）渲染进 `AlignmentPhrases` 的 chip 行，而该行 `height: var(--h-phrases)` 固定 44px、外层 `ProtocolBand` 又是 `overflow: hidden` —— **「取消 / 保存」按钮不可见、鼠标不可达**，只有 `⌘Enter` 盲提交与 `Esc` 关闭还能用。快捷键的存在恰好掩盖了缺陷，测试全绿也没暴露。

摸底证实这不是孤例：

| 编辑面 | 容器 | 字段数 | 宿主尺寸约束 | 现状 |
|---|---|---|---|---|
| 对齐话术 | chip 行内嵌 `EditorPanel` | 2 + 双按钮 | **固定 44px**，外层 band `overflow:hidden` | ❌ 裁切 |
| Scene 话术 | 列内就地 | 3（含子阶段选择） | 列宽 | ⚠️ 挤压 |
| Macro | 卡片位就地 | 2 | 网格单元 | ✅ 勉强 |
| Scene 属性 | 就地 `EditorPanel` | 5（含色板 / 角色 chips） | 面板宽 | ⚠️ 偏高 |
| 草稿 | inbox 内 | 2 | 尚可 | ✅ |
| 设置 | Modal | 多 | 无 | ✅ |

**根因 A**：项目只有 `EditorPanel` **一种编辑容器**，且它渲染在**宿主的文档流里**——宿主的尺寸约束直接成了编辑器的天花板。

### 触发事件 B：键盘编辑路径系统性受损（体验缺陷）

本工具的身份是键盘优先：热键唤起、`⌘1-8` 直切、`⌘K` 搜索、Tab 在 6 区域间循环、`useRegionNav` 在区域内 roving focus。**但编辑动作层完全是鼠标范式**，且被硬塞进了键盘导航序列里。

实测（2026-08-16 逐组件 grep `data-nav-item`）：

| 组件 | 每个条目的 arrow 停靠点 | 后果 |
|---|---|---|
| `AlignmentPhrases` 的 `PhraseChip` | **6**（chip 本体 + 设为默认 / 编辑 / ← / → / 删除） | 4 条话术的相位，横穿一行按 **24 次**方向键 |
| `scene/ViewPhraseCard` | **7** | 5 张卡的子阶段列 = **35 次** |
| `MacroGrid` | 5 | 同类 |

而这些动作按钮是 `opacity: 0`（`AlignmentPhrases.module.css:119-127`），hover / `:focus-within` 才显形——**用方向键穿行时，控件会一路忽隐忽现**。

**根因 B**：动作簇按鼠标 hover 范式设计（ADR-021 的落地形态），却又整体挂进了键盘 roving 序列。两种范式叠加，结果是两边都不好用：鼠标要精确瞄准小图标，键盘要穿过大量隐形停靠点。

> 这不是「编辑低频所以可以将就」。低频 + 高摩擦 = 用户每次都记得的糟糕时刻。Raycast / Linear / Things 之所以是优秀工具，恰恰因为冷路径与热路径一样精。

### 业务约束

- [[02-constitution#C1]]：主形态唤起 ≤ 200ms P95——编辑层与键盘层不得进入启动路径，必须惰性
- [[02-constitution#B2]]：协议层 / 任务层物理分离——协议层话术的编辑浮层不得渲染进任务层区域的 DOM 或视觉范围
- [[01-spec]] 哲学二「看见全局」：一屏全景不可被编辑器长期占据
- 「复制即完成」是主动作：任何编辑 affordance 不得侵占整卡 / 整 chip 的 copy 热区（[[021-scene-layered-editing#3]] 已确立）
- [[021-scene-layered-editing]]：**就地编辑、无全局编辑态**是已拍板原则，本 ADR 不推翻它——换的是实现容器与 affordance 载体
- `interactionMode: invoke | organize` 已存在并持久化（`settingsStore.ts:48`），是键盘动作层的现成挂载点

### 技术约束

- **不能 portal 到 body**：band 的 token remap（`--fg-1`/`--surface-1`/`--accent` 等 20 个变量）靠 CSS 继承实现（[[020-restore-protocol-dark-band]]），浮层一旦 portal 出 band 子树，全部变量回落全局值，暗底上出现暗字
- **CSS anchor positioning 不可用**：WKWebView 用系统内核，该特性 Safari 26 起才支持（等于要求 macOS Tahoe 26+），而 `tauri.conf.json` 未设 `minimumSystemVersion`
- **依赖精简**：`package.json` 声明 11 条运行时依赖，其中 4 条是 Tauri 官方 API/插件，**非 Tauri 的前端库只有 7 个**，无 floating-ui、无 Radix
- **无 z-index 标尺**：`SettingsModal` 硬编码 `z-index: 10`、`SearchOverlay` 用 `1`，`tokens.css` 无 `--z-*`
- **无软删除**：`delete_*` 是硬删除，无回收站表、无 `deleted_at`——**任何"删除可撤销"方案都必然是后端契约变更**，不存在纯前端解（见子决策 5）
- **写命令是绝对状态、幂等**：`reorder_*` 收 `ordered_ids: Vec<String>` 完整列表（`commands.rs:472`），`set_default_alignment_phrase` 收 `(phase_id, id)`。写连接经 `with_write_conn` 串行。**这决定了不需要并发协议，也决定了连续移位天然安全**（见子决策 4）
- **jsdom 不支持 `popover` API**（实测 jsdom 29.1.1）：`'popover' in el === false`、`showPopover` 为 `undefined`。这是一项**测试环境成本**（约 20 行 setup shim），不构成否决平台能力的理由
- **应用外壳是 inset 浮动框**：`.dashboard` 为 `position: fixed; inset: var(--s-3); overflow: hidden` + 圆角。浮层夹取边界必须是 **dashboard 矩形**而非视口
- **hover lift 是 containing block 陷阱**：五处卡片 hover 时施加 `transform: translateY(var(--lift-1))`——`MacroGrid.module.css:96` / `ScenePanel.module.css:397` / `RecentList.module.css:100` / `ModifierGrid.module.css:158` / `ScenePropertiesEditor.module.css:70`。transform 元素会成为其 `position: fixed` 后代的包含块（top layer 方案可绕开，见子决策 1）
- **锚点自身可能在滚动容器里**：chip 行是 `overflow-x: auto`（`AlignmentPhrases.module.css:11`），Scene 列与 Recent 列同样可滚。**定位不能只监听 `resize`，必须观察所有相关滚动祖先**
- **`useRegionNav` 已留好扩展位**：第 32 行显式 `if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;`——⌘/⌥/⇧ 组合键已让给其他 handler，动作键层可直接叠加

### 外部证据（调研收敛，来源见 §相关链接）

1. **容器由字段数与任务性质决定，不由宿主位置决定**。Apple HIG：popover = 少量相关属性、一次性、点外关闭；sheet = 有界任务需显式提交；panel = 反复输入观察结果。Cloudscape 明确 inline edit 只适用于「跨多条资源改单个属性」，**多字段表单不在其适用域**
2. **Linear 的原则不是「不用 modal」而是「不打断」**：overlay 短暂、键盘可关、不阻塞状态；工程上**永不动画会触发 layout 的属性**
3. **hover-reveal 有明确成本**（NN/g + WCAG 1.4.13）：hover 只能强化可发现性，不能承担它；≤2 个高频动作应常显，3+ 应收进**常驻**触发器
4. **主动作必有快捷键 / 列表即管理界面 / 模板优先于空表单**（Raycast 三条铁律）
5. **顺序处理优于分屏**（Superhuman）：键盘分诊模型下，"处理完自动到下一条"比"左右分屏看详情"吞吐量更高
6. **撤销 > 确认**（NN/g），但仅限真正可逆的动作

### 不决策的代价

- 每新增一个编辑面就复现一次「宿主尺寸吃掉编辑器」，只能逐个打补丁
- 键盘编辑路径的摩擦随资产量线性放大——库越大，越难用
- 动作簇的 hover 依赖持续累积可发现性债与 WCAG 债
- 工具停在「能编辑」，到不了「编辑很爽」，与「手动挡仪表盘」的定位相悖

## 4. Options Considered

### Option A: 逐个宿主扩容

- **描述**：`AlignmentPhrases` 行 `height` 改 `min-height`、band 解 `overflow: hidden`；其余宿主各自调尺寸。
- **优点**：改动 2-3 行即可止血；零新概念；风险最低。
- **缺点**：band 高度随编辑器跳变会推下 Macro/Scene，破一屏全景；编辑器仍在横向流里挤 chip；**根因 A 未动**，下个宿主继续复现；**根因 B 完全未触及**；band 解 `overflow: hidden` 会让 `--r-frame` 圆角失效。
- **预估成本**：0.5 天，交付一个还会复发的中间态。

### Option B: 统一锚定编辑层 + 键盘动作层（选定）

- **描述**：两层组合。(1) **容器层**——编辑器脱离宿主文档流，由原生 `popover` 渲染进 top layer、锚定在触发元素上；(2) **交互层**——动作按钮退出 arrow 导航序列，改为选中项上的直接按键，动作簇跟随选中态常显，`⌘Enter` 保存并推进到下一条，`⌥↑↓` 连续移位。
- **优点**：同时解掉根因 A 与 B；不推翻 ADR-021 的就地心智（锚点即触发点）；`PhraseChip` 停靠点 6→1、`ViewPhraseCard` 7→1；hover 依赖解除，WCAG 1.4.13 债一并清；top layer 天然逃逸 `overflow: hidden`、z-index 竞争与 transform 包含块；键盘 substrate（`useRegionNav`）已存在，是叠加不是新建。
- **缺点**：引入浮层生命周期管理（Esc / 点外 / 焦点归还）；动作键需要一套跨区域一致的键位约定，且要与 IME、原生编辑键不冲突；测试面显著变宽（键盘路径 + 浮层路径）。
- **预估成本**：4 阶段约 5-6 天（见 §6）。

### Option C: 全部编辑移入 Modal

- **描述**：所有编辑走 `SettingsModal` 式居中弹窗。
- **优点**：一种容器打天下；实现最简单；无定位计算。
- **缺点**：直接推翻 ADR-021「废除全局编辑态、就地编辑」的核心结论，回到用户当初抱怨的「过于抽象」；每次改名都全屏打断，违反 Linear「不打断」与 HIG「modal 只用于必须先完成的有界任务」；丢失空间锚点；**根因 B 未解**。
- **预估成本**：2 天，且要开 ADR 推翻 021。

### Option D: organize 侧栏（side peek）

- **描述**：右侧常驻详情面板，编辑在面板内进行。
- **优点**：适合连续编辑多条；有现成 `interactionMode` 可挂。
- **缺点**：**它解的是错的问题**——痛点不是"看不见详情"，是"逐条往返 + 键盘不通"。侧栏引入第二处布局分支、Notion 已验证的嵌套滚动债、以及"模式内模式"；invoke 态下仍不能快速改字。Option B 的连续处理模型用更简单的结构拿到更高的吞吐。
- **预估成本**：2.5 天，交付一个结构更重、收益更低的东西。

## 5. Decision

> **一句话拍板**：选择 Option B —— 编辑器改为锚定在触发元素上的 top layer 浮层（解容器错配），organize 改为选择驱动的键盘处理模式（解交互摩擦）。

**为什么不选其他**：

- 不选 A 因为：它修的是症状（这一个宿主太矮），不是病因
- 不选 C 因为：为了容器统一去推翻 ADR-021 的就地原则，是拿正确的结论换错误的便利
- 不选 D 因为：它解的是错的问题，且结构比 B 更重

### 子决策 1 — 定位实现：原生 `popover` 属性（top layer）+ 自写定位 hook

编辑器用 HTML 原生 `popover="manual"` 承载：**元素渲染进 top layer，DOM 位置不变**。两个关键收益：

1. **band 的 token remap 完整保留**——top layer 只改绘制与堆叠，不改 DOM 祖先链，CSS 自定义属性照常继承（这是"不能 portal 到 body"约束的正解）
2. **一次绕开三个坑**——祖先 `overflow: hidden` 裁剪、z-index 竞争、hover-lift 的 transform 包含块（top layer 元素的包含块是初始包含块）

位置计算自写 `useAnchoredPosition`：测触发元素 rect → 优先放下方 → 空间不足翻上 → 夹取到 **dashboard 矩形** → **观察所有滚动祖先 + resize**。配套新增 `--z-*` 层级标尺，收编 `SettingsModal`(10) / `SearchOverlay`(1) 的硬编码。

**关于 jsdom**：29.1.1 不支持是事实，代价是约 20 行 setup shim（暴露 `showPopover`/`hidePopover`/`togglePopover` 与 `:popover-open`）。多数编辑器测试验的是渲染、提交、焦点与回调，不需要模拟真实 top layer。**用测试环境的 shim 换一项平台能力，方向反了。**

**原生 light-dismiss 不够用，但不是否决理由**：子决策 2 要「点外 = 保存并关闭」，原生 light-dismiss 只隐藏不保存，关闭策略仍由应用接管（`toggle` 事件 + 自己的 outside 判定）。保留原生的 top layer、Esc、焦点与堆叠语义即可。

**两个否决**：不引入 floating-ui（锚定需求只有「下方 / 翻转 / 夹取」三种）；不用 CSS anchor positioning（要求 macOS 26+）。

**仍需真机验证**（jsdom 与 shim 都验不了）：top layer 下 band 变量继承、滚动跟随、焦点归还、hover-lift 卡片下的定位稳定性。见 §6 验收门 G1。

### 子决策 2 — 保存语义：显式保存 + 点外保存 + `⌘Enter` 保存并推进

- 编辑器保留可见的「保存」按钮与 `⌘Enter`（沿用 A1-08 统一提交键，Raycast 铁律「主动作必有快捷键」）
- **`⌘Enter` = 保存并推进到下一条**（organize 态）/ 保存并关闭（invoke 态）。这是连续处理模型的核心：编完一条自动落到下一条，不必重新寻址
- **点击浮层外部 = 保存并关闭**（HIG：非模态 popover 自动关闭时必须保存工作）
- `Esc` = 放弃并关闭；关闭后焦点归还触发元素

**这是数据丢失契约的变更，不只是容器变更**。现状 `PhraseFormEditor.tsx:82` / `:92` 是 Esc 立即关闭、`onClose` 即取消、只有 `onSubmit` 才落库。改为「点外保存」必须补齐规则表，否则会静默丢数据或静默存脏数据：

| 场景 | 规则 |
|---|---|
| 点外部、内容合法且 dirty | 保存并关闭 |
| 点外部、内容**校验不通过**（名称或正文为空） | **不关闭**，浮层保持打开并高亮失败字段——不能因为点了别处就丢掉半条话术 |
| 点外部、内容未改动（not dirty） | 直接关闭，不发 IPC |
| `Esc`、内容 dirty | 关闭并放弃；创建态给撤销 toast（编辑态原值仍在库中，无需 toast） |
| `⌘Enter` 于最后一条 | 保存并关闭，不回卷到第一条 |

dirty 判定以初始值快照比对，不以「是否聚焦过」判定。

### 子决策 3 — 键盘动作层：organize 从「带按钮的浏览」升级为「选择驱动的处理模式」

这是本 ADR 的第二根支柱，对应根因 B。四条改动：

**3.1 动作按钮退出 arrow 导航序列**

去掉动作簇 IconButton 上的 `data-nav-item`，方向键只在**条目**之间移动。`PhraseChip` 6 停靠点 → 1，`ViewPhraseCard` 7 → 1。4 条话术的相位从 24 次按键降到 4 次。

**3.2 动作变成选中项上的直接按键**

| 键 | 动作 | 备注 |
|---|---|---|
| `Enter` / `Space` | 复制（主动作不变） | 守「复制即完成」 |
| `E` | 打开锚定编辑器 | |
| `R` | 就地重命名（单字段） | Cloudscape inline edit 的正确适用域 |
| `⌘D` | 设为默认（仅对齐话术） | |
| `⌥↑` / `⌥↓` | 上移 / 下移一位，**可连按** | `useRegionNav:32` 已让出 ⌥ |
| `⌫` | 删除（走现有确认） | 见子决策 5 |

裸字母键仅在**焦点位于条目本身**时生效；焦点进入任何 `INPUT` / `TEXTAREA` / `contentEditable` 或 IME 合成中时全部让路（复用 `useRegionNav` 已有的三重护栏）。

**3.3 动作簇从 hover-reveal 改为选中态跟随**

动作簇只在**当前选中 / 焦点条目**上常显，其余条目不显。这一条同时结清三笔债：

- NN/g 的可发现性债——不再要求用户"先猜到这里能 hover"
- WCAG 1.4.13 的 dismissible / hoverable / persistent 三件套——不再依赖 hover 触发
- reflow 抖动——动作位固定宽度预留，显隐不挤动相邻条目

鼠标 hover 保留为**次要**通路（hover 也点亮动作簇），但不再是唯一通路。

**3.4 连续移位安全性**

`⌥↑↓` 连按会连续发出 `reorder_*`。因为每次调用携带**完整目标顺序**且幂等（见 §3 技术约束），连按天然安全——无需节流、无需队列、无需版本号。这是绝对状态写入的直接红利。

**延伸（P3，同属键盘模型）**：

- **搜索 → 编辑打通**：`⌘K` 结果上 `⌘Enter` = 跳到该条目并进入编辑态。当前 `SearchOverlay` 只能复制，编辑与调用是两条割裂路径；优秀的 launcher 里它们是同一条（Raycast「列表即管理界面」）
- **模板化空状态**：新建话术 / Macro 时，空状态给可选模板而非空白字段（Raycast「模板优先于空表单」）

### 子决策 4 — 零表单动作清单：无并发协议，失败即重拉

`reorder_alignment_phrases` / `reorder_macros` / `reorder_modifiers` / `reorder_phrases` / `reorder_scenes` / `reorder_sub_stages` / `reorder_compositions` / `set_default_alignment_phrase` / `move_phrase`（已有 MoveReceipt）—— 一律不开表单，动作即生效，乐观更新。

**失败处理只有一条规则**：

> 不做反向回滚，直接 `list_*` 重拉权威状态 + toast 提示。

**为什么不需要并发协议**（第一轮审查曾要求补 op id / 乱序丢弃 / 增量回滚，本轮撤回）：这些命令传的是**完整目标状态**而非相对操作（`reorder_*` 收 `ordered_ids: Vec<String>`，`commands.rs:472`）。绝对状态 + 幂等意味着 last-write-wins 本身就是正确语义；写连接经 `with_write_conn` 串行，乱序落库几乎不可达；即便发生，重拉必然收敛。**为绝对状态写入建版本协议，是为不存在的问题建机器。**

### 子决策 5 — 删除：维持现有确认框，本 ADR 不动删除语义

起草稿曾提议「DeleteReceipt + 撤销 toast」替代 inline confirm，**已撤回**——它正是 [[022-cross-scene-phrase-move]] 亲手否决的 Option C：

> 「前端组合 create + delete 重建 …… **丢失 usage_count / last_used_at / created_at / id**（正是当前 workaround 的缺陷，等于把 bug 固化为实现）」（`022:57`）

按原索引重建一条被删记录等价于 `create` 新行，必然换新 id、丢 `created_at` 与 usage 历史。援引 022 的 Receipt 先例来做这件事，恰恰违背 022 的结论。

**因此**：`delete_*` 沿用现有内联确认槽。真正可撤销的删除需要后端软删除（`deleted_at` + `restore_*`），是独立的后端契约决策，**若要做另开 ADR**。

> MoveReceipt 不受影响：`move_phrase` 是单条 UPDATE，撤销是反向 UPDATE，保住 id 与全部字段——与重建式删除不是一回事。

### 子决策 6 — PhaseBar 主角化复核（**推翻 ADR-024 一个子项，需 omar 单独点头**）

现状：active 相位 `flex-grow: 2.2` + `font-size 13→18`（`PhaseBar.module.css:66-72`），且 `.phase` 基类**对 `flex-grow` 与 `font-size` 都挂了 transition**（`:45-49`）。三个后果：

1. 每次切相位 8 格宽度全部重排，鼠标肌肉记忆位置随之漂移
2. 对 `flex-grow` / `font-size` 做动画是最贵的属性组合（每帧 layout + 文本重排），同时违反 Linear「永不动画 layout 属性」与 Rauno「selected 态不改字重字号」
3. 走查实证：活动相位被撑宽在最右，而它驱动的 chip 行在最左下，焦点与内容分居对角线两端

**提议**：保留「活动相位是主角」的意图，改用**不触发 layout 的手段**表达——等宽格 + 背景 / 描边 / 下划线 / 序号章的视觉权重变化，字号恒定。ADR-024 的身份设计（`--brand` 恒定色系、深色驾驶舱）完全保留。

**本项与其余五条零依赖**，可最先独立落地。

## 6. Consequences

### 正向后果

- 六个编辑面的尺寸错配一次性解决，新增编辑面不再受宿主尺寸支配
- **键盘穿行成本降一个数量级**：`PhraseChip` 6 停靠点 → 1，`ViewPhraseCard` 7 → 1
- **9 个写命令**从"开表单"降为"动作即生效"；重命名从整表单降为单字段就地编辑
- hover 依赖解除，NN/g 可发现性债与 WCAG 1.4.13 债一并结清
- 解锁 `--z-*` 层级标尺，收编既有硬编码 z-index
- top layer 让后续任何浮层（tooltip / kebab / 未来命令面板）有统一底座，不必参与 z-index 竞争
- 搜索与编辑合流后，`⌘K` 从"复制入口"升级为"资产总入口"

### 反向后果

- 引入浮层生命周期这一新复杂度：焦点归还、Esc 冒泡、点外判定、多浮层互斥，都是易回归项
- **裸字母动作键是一类新的冲突面**：与 IME、与未来可能的类型化搜索（type-ahead）、与系统快捷键都需持续避让。护栏虽复用 `useRegionNav` 三重判断，但每新增一个键都要重新过一遍
- **jsdom 需要 `popover` shim**，且 shim 验不了真实 top layer——测试可信度依赖真机走查，不能只看绿灯
- 定位是 JS 计算而非声明式，滚动 / resize 需主动重算；**锚点自身就在滚动容器里**，是已知易错点
- 保存语义从"显式提交"改为"点外也保存"，是数据契约变更，误触成本上升——靠子决策 2 的规则表兜底
- 动作簇改为选中态跟随后，**未选中条目不再显示任何 affordance**，首次使用者需要一次学习（缓解：hover 保留为次要通路）
- 子决策 6 若通过，ADR-024 落地不足一个月即被局部修订，视觉身份稳定性受一次扰动
- **本 ADR 打包了容器、保存语义、键盘模型、PhaseBar 四类决策**。外部审查建议拆分，决策者选择保持整体、以验收门代替拆分控制回滚边界——代价是回滚粒度较粗

### 分期与验收门

**P0 · PhaseBar（今日，独立）**：子决策 6。与其余五条零依赖，不应被编辑体系进度绑架。

**P1-a · 容器单点验证**：`--z-*` 标尺 → `AnchoredEditor`（原生 `popover` + jsdom shim）+ `useAnchoredPosition` → **只接对齐话术这一处**。

> **验收门 G1（真机，非 jsdom）**——全部通过才进 P1-b：
> 1. 暗 band 内浮层配色正确（证明 top layer 未破坏 CSS 变量继承）
> 2. chip 行横向滚动时浮层跟随锚点，不脱锚
> 3. 「保存 / 取消」按钮完整可见可点（触发缺陷已消灭）
> 4. 关闭后焦点回到触发 chip
> 5. 在 hover-lift 卡片（Macro / Scene）上开浮层，hover 进出时位置不跳
> 6. `pnpm bench:hotkey-wake` P95 仍在 C1 预算内

**G1 走查结果（2026-08-19）**——**未全过，两项 deferred，omar 拍板放行 P1-b**：

| 项 | 结论 | 证据来源 |
|---|---|---|
| 1 / 3 / 4 | 通过 | **omar 真机目视确认**。AI 侧两轮共 75 帧屏幕捕获**未拍到浮层**，故这三项不含 AI 观测证据，仅凭人工走查结论 |
| 6 | 通过 | `pnpm bench:hotkey-wake` p95 = **15.3ms** / C1 预算 200ms，与 2026-06-12 签名后基线 12.9–13.5ms 同档，无回归。AI 实测 |
| 2 | **deferred → P1-b 门** | **当前数据下物理不可验**：8 个相位最多一个只有 3 条对齐话术，窗口 `decorations: false` 满屏宽拖不动，chip 行 `overflow-x: auto` 不溢出，无滚动可滚。要验须批量造 12+ 条临时话术 |
| 5 | **deferred → P1-b 门** | **P1-a 阶段不适用**：本项要求在 hover-lift 的 Macro / Scene 卡片上开浮层，而 P1-a 只接对齐话术一处，那五个编辑面仍是流内 `EditorPanel`，无浮层可开。G1 原文把一个只有迁移后才存在的对象写进了迁移前的门 |

> ⚠️ **项 2 是 G1 中唯一覆盖 `useAnchoredPosition` 的 `scrollableAncestors` 那段的检查**——滚动祖先订阅是整个定位实现里最易错、jsdom 又完全测不到的部分。它至今**零覆盖**（既无 jsdom 测试也无真机验证）。P1-b 迁移的五个编辑面中，Scene / Recent 列都是纵向滚动容器，届时这段代码将首次被真实使用。**P1-b 收口前必须补上，不得再 defer 一轮。**

**P1-b · 容器迁移**：其余五个编辑面跟迁。迁移前先定 `AnchoredEditor` 与 `PhraseFormEditor` 的接口契约（`layer` / `extraFields` / `submitLabel` / 自定义 className 全覆盖），否则迁移工时不可信。

**P2 · 键盘动作层**：子决策 3.1–3.4 + 子决策 4。**先在对齐话术一个区域跑通全套键位，再铺其余区域。**

> **验收门 G2（真机）**：
> 1. 4 条话术的相位，横穿一行 ≤ 4 次方向键
> 2. `⌘Enter` 保存后焦点确实落在下一条，最后一条不回卷
> 3. `⌥↑` 连按 5 次，落库顺序与屏幕顺序一致
> 4. 中文输入法合成态下，裸字母键不触发任何动作
> 5. 未选中条目无动作簇，选中条目动作簇不挤动相邻条目

**P3 · 合流**：搜索 → 编辑打通；模板化空状态。

工时估算：P0 约 0.5 天 / P1 约 2 天 / P2 约 2 天 / P3 约 1 天，合计 5-6 天。

### 未来反悔成本

- **代码改造规模**：约 12 个组件 + 1 个新 primitive + 1 个 hook 扩展 + tokens + 测试 shim；回退需改回 6 个宿主的渲染位置并恢复动作簇的 `data-nav-item`，估 800-1200 LOC
- **数据迁移**：**无**。不动 schema、不动 IPC 签名——这一点在子决策 5 撤回 DeleteReceipt 后才真正成立
- **学习成本**：无新框架，`popover` 是平台原生 API
- **不可逆点**：
  - 键位约定一旦形成肌肉记忆，再改键位比第一次定更痛——**键位表应一次定死**
  - 保存语义改为「点外也保存」后，再改回显式提交是二次伤害
  - 子决策 6 若通过并发布，PhaseBar 视觉再改回主角化就是第三次反复
  - 删除语义**未动**，不构成不可逆点——真正的软删除留待独立 ADR

---

## 反模式（写完自检）

- ✅ Options 4 个，非通告
- ✅ Decision 一句话说得清，六条子决策独立可摘
- ✅ Consequences 含反向后果与不可逆点；jsdom `popover` 支持、hover-lift 包含块、滚动容器锚点、导航停靠点数量、写命令幂等性五项均已实测，从「判断」降为「事实」
- ✅ 已过一轮独立模型对抗审查 + 一轮第一性原理复核；采纳、未采纳、经核实驳回三类意见均留档于 §2，不做选择性引用
- ⚠️ 本 ADR 记录决策不含实现规格——键位表的最终字母、字段级契约留给 [[03-product-spec#13.3]] / [[03-product-spec#13.4]] 回流与实施 plan
- ⚠️ 子决策 6 触及既有 ADR，已显式标注需单独点头，不夹带通过

## 相关链接

- **触发本决策的文档**：[[03-product-spec#13.3]] 区域 2-bis 对齐话术；走查实证（2026-08-14）；键盘导航实测（2026-08-16）
- **被本决策影响的文档**：[[03-product-spec]] §13.3 + §13.4 / [[05-design-spec]]（overlay 层级 + 选中态 + 焦点环）/ [[07-features#3.8]] / [[11-test-spec]] / [[CLAUDE#§7]]
- **相关 ADR**：[[021-scene-layered-editing]]（就地原则不变；动作簇载体从 hover 改为选中态）/ [[022-cross-scene-phrase-move]]（其 Option C 否决理由 `022:57` 是撤回 DeleteReceipt 的直接依据）/ [[020-restore-protocol-dark-band]]（token remap 约束来源）/ [[024-dark-cockpit-identity]]（子决策 6 复核其 PhaseBar 子项）/ [[016-choose-dnd-and-resizable-layout]]（排序沿用既有链路）
- **外部依据**：
  - [Apple HIG – Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers) / [Sheets](https://developers.apple.com/design/human-interface-guidelines/components/presentation/sheets/)
  - [Cloudscape – Inline edit](https://cloudscape.design/patterns/resource-management/edit/inline-edit/) / [Atlassian – Inline edit](https://atlassian.design/components/inline-edit/) / [GitLab – Modal](https://design.gitlab.com/components/modal)
  - [NN/g – Efficiency vs Expectations](https://www.nngroup.com/articles/efficiency-vs-expectations/) / [NN/g – Confirmation Dialogs](https://www.nngroup.com/articles/confirmation-dialog/) / [NN/g – Timing Exposing Content](https://www.nngroup.com/articles/timing-exposing-content/) / [NN/g – Data Tables](https://www.nngroup.com/articles/data-tables/)
  - [WCAG 1.4.13 – Content on Hover or Focus](https://www.w3.org/WAI/WCAG21/Understanding/content-on-hover-or-focus)
  - [Rauno – Web Interface Guidelines](https://interfaces.rauno.me/) / [How is Linear so fast](https://performance.dev/how-is-linear-so-fast-a-technical-breakdown)
  - [Raycast – Snippets](https://www.raycast.com/core-features/snippets) / [Raycast Developer Program](https://www.raycast.com/developer-program) / [Retool – Designing the Command Palette](https://retool.com/blog/designing-the-command-palette)
  - [WebKit Features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)（anchor positioning 支持下限依据）
