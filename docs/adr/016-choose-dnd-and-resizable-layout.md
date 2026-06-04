---
type: adr
project: prompt-hub
id: ADR-016
status: Accepted
date: 2026-06-04
description: 选择 @dnd-kit/react 0.4.x（新版体系）做区域内拖动排序 + react-resizable-panels ^4 做可拖分隔条布局；锁定三依赖引入，校正「v4 仅百分比无 px」假设。支撑 asset-editing-and-adaptive-layout plan P1–P4
related:
  - asset-editing-and-adaptive-layout
  - 09-tech-stack
  - 03-product-spec
  - 05-design-spec
  - 012-lock-visual-quality-anchor
  - 014-nspanel-isa-swizzle
  - 002-choose-frontend-framework
  - 009-choose-styling
  - CLAUDE
---

# ADR-016: 选择 @dnd-kit/react + react-resizable-panels（拖动排序 + 可调布局）

> **铁律自检**：两个子决策（拖拽库 D-A / 分隔条库 D-B）各列 Options ≥2；Decision 各一句话；Consequences 含未来反悔成本。

## 1. 标题与日期

- **标题**：选择 `@dnd-kit/react@0.4.0` + `@dnd-kit/helpers@0.4.0`（新版体系）实现区域内卡片拖动排序，`react-resizable-panels@^4` 实现可拖分隔条 + 布局比例持久化；引入此三依赖
- **日期**：2026-06-04
- **决策者**：omar
- **影响范围**：[[09-tech-stack#§3]] 依赖表 +3 / [[asset-editing-and-adaptive-layout]] P1.4（dnd 排序）+ P4（分隔条）/ [[05-design-spec]] token px↔% 关系 / [[014-nspanel-isa-swizzle]] key-window 是键盘 sensor + resize-handle focus 前置 / [[012-lock-visual-quality-anchor]] 拖动交互不得破坏 Linear 气质

## 2. Status

`Accepted`（2026-06-04，omar 人审通过；三版本 `npm view` 核验真实存在：`@dnd-kit/react@0.4.0` / `@dnd-kit/helpers@0.4.0` / `react-resizable-panels@4.11.2`）

> Accepted 后方可 `pnpm add` 三依赖并同步 [[09-tech-stack]]。

## 3. Context

### 触发事件
[[asset-editing-and-adaptive-layout]] plan v0.2 要把 Dashboard 从「只读 + 仅草稿流水线」升级为「4 类资产全编辑 + 自适应/可调布局」。其中**区域内拖动排序**（P1.4）与**可拖分隔条**（P4）需引入新前端依赖——按 [[CLAUDE#§5.3]]「新技术选型先开 ADR 锁定」，此决策是 P1.4 的硬阻塞。

### 业务约束
- [[02-constitution#B2]] 物理分离：拖动只能**区域内排序**，禁跨区域自由拖放、禁跨资产类型拖动（不得把 Macro 拖进对齐区改类型）
- [[012-lock-visual-quality-anchor]] Linear 气质：拖动交互须克制（handle 明确、激活阈值防误触），不做花哨动画
- [[05-design-spec]] 用 px token（`--space-*`）——分隔条库的尺寸单位需与 token 体系对齐

### 技术约束
- React 19.2（[[002-choose-frontend-framework]]）——拖拽库必须支持 React 19，旧 `react-beautiful-dnd` 已废弃
- [[014-nspanel-isa-swizzle]] NSPanel key-window：dnd-kit 键盘 sensor 与 resize-handle focus 依赖窗口可成为 key-window，需 P1.5 实机验证
- [[009-choose-styling]] CSS Modules + 零运行时偏好——分隔条库不应引入重运行时开销
- 不在主形态唤起路径上（[[02-constitution#C1]] 200ms）——拖拽/分隔条仅在 Dashboard 内交互时加载，不影响冷启动

### 参考验证（四路开源调研，2026-06-04）
- **拖拽**：实测多个用新版 `@dnd-kit/react` 的真实仓库——typebot.io（9.9k★，`DragDropProvider`+`move`+`handleRef` 极简范例）、Seelen-UI（17k★，轴约束 + sensor 集中）、puck（12.8k★，纯手动排序）、aether（取消回滚快照范本）、budget-board（服务端失败 `onError` 回滚）
- **分隔条**：react-resizable-panels（5.3k★，作者 Brian Vaughn / React DevTools 作者，shadcn/ui Resizable 底座）、dannysmith/tauri-template（同构栈 Tauri2+React19.2+Zustand5，但锁 v3）
- 调研正文存档：`docs/research/2026-06-04-resizable-panels.md`

### 不决策的代价
- P1.4 / P4 无法开工，plan 全期阻塞
- AI 可能误用 legacy `@dnd-kit/core`+`sortable`（React 19 不兼容新范式）造成返工

## 4. Options Considered

### 子决策 D-A：拖拽排序库

#### Option A-1: `@dnd-kit/react@0.4.0` + `@dnd-kit/helpers@0.4.0`（新版体系）← 选

- **描述**：dnd-kit 新版 `/react` 包，`DragDropProvider` + `useSortable` + helpers 的 `move`；**无** legacy `SortableContext`/`arrayMove`
- **优点**：
  - 2026 React 拖拽事实标准，原生支持 React 19（旧 `react-beautiful-dnd` 已废弃）
  - 新版 API 更简洁：`onDragEnd={e => setOrder(move(ids, e))}`，handle 用官方 `handleRef`（比 `data-no-dnd` 干净）
  - 取消回滚内建：`onDragStart` 存快照 + `onDragEnd` 判 `event.canceled` 即可还原（aether 范本验证）
  - 键盘 sensor 内建（无障碍 + 键盘优先，契合 Linear 气质）
  - 轴约束、激活距离阈值（防误触）开箱即用（Seelen-UI/puck 验证）
  - 真实仓库可整段照搬（typebot.io ColumnSettings）
- **缺点**：
  - 0.x 版本号（API 仍可能小变），文档较新、中文资料少
  - 与旧版心智不同，过往 dnd-kit 经验需重学
- **预估成本**：低（有可照搬范例），学习 0.5-1 天

#### Option A-2: legacy `@dnd-kit/core` + `@dnd-kit/sortable`（旧版体系）

- **描述**：dnd-kit 经典 `SortableContext` + `arrayMove` 套路
- **优点**：资料多、教程全、用例海量
- **缺点**：
  - React 19 下新项目不推荐，官方已转向 `/react` 新范式
  - 与 A-1 二选一并存会造成心智分裂（同库两套 API）
- **预估成本**：低，但选它等于选了将被淘汰的范式

#### Option A-3: `react-dnd`

- **描述**：老牌 HTML5 backend 拖拽库
- **优点**：成熟稳定
- **缺点**：API 重、样板多；React 19 维护活跃度下降；无内建 sortable helper
- **预估成本**：中

#### Option A-4: `@atlaskit/pragmatic-drag-and-drop`（Atlassian）

- **描述**：Atlassian 出品、框架无关、性能极佳的拖拽底座
- **优点**：性能/包体优秀，大厂背书
- **缺点**：偏底层（需自行组装 sortable/键盘/回滚），上手成本高于 dnd-kit；React 适配层薄
- **预估成本**：中-高

#### Option A-5: 自建拖拽

- **描述**：手写 pointer/keyboard 事件 + 排序逻辑
- **优点**：零依赖、完全可控
- **缺点**：键盘无障碍/轴约束/防误触/回滚全自造，工作量大、坑多（社区公认拖拽是高坑领域），违反 [[CLAUDE]]「借力最优解」
- **预估成本**：高

### 子决策 D-B：可拖分隔条库

#### Option B-1: `react-resizable-panels@^4` ← 选

- **描述**：Brian Vaughn 出品，`Group`/`Panel`/`Separator`（v4 命名）+ `autoSaveId`/`useDefaultLayout` 持久化
- **优点**：
  - React 可调布局事实标准（5.3k★ / MIT / shadcn/ui Resizable 底座 / 活跃发版）
  - 布局比例持久化内建（`autoSaveId` 自动写 localStorage；v4 `useDefaultLayout` 含 legacy 布局自动迁移）
  - **v4 支持多单位**（px/percent/rem/em），可直接传 token px 值（`minSize="240px"`），库内 ResizeObserver 校验——见下「校正」
  - 窗口 resize 自动重算
- **缺点**：
  - v4 较新，多数真实项目（含 tauri-template）仍用 v3，需注意 `Group/Panel/Separator` 改名
- **预估成本**：低，建议锁 `^4.11`（latest 4.11.2）

> 🔴 **校正 plan v0.2 §0 Q7 假设**：plan 称「v4 仅百分比、无 px」**有误**。官方 4.0.0 release note 原文支持 px/percent/rem/em；v4 移除的是 v2 时代 `defaultSizePixels`/`minSizePixels` 后缀属性体系，改为「数字=px、无单位字符串=百分比、带后缀=对应单位」的统一解析。**结论：原计划的 px↔% 换算 util 大部分可省**，token px 值可直接传入。

#### Option B-2: `react-resizable-panels@^3`

- **描述**：同库 v3，`PanelGroup`/`Panel`/`PanelResizeHandle` 旧命名
- **优点**：用例最多（tauri-template 同构栈实战），稳定
- **缺点**：无 `useDefaultLayout`；既然新引入，无理由锁旧 major
- **预估成本**：低，但选旧 major 后续仍要升 v4

#### Option B-3: `allotment`

- **描述**：原生 px min/max 的分隔布局库
- **优点**：px 原生，对 token px 思维天然友好
- **缺点**：1.2k★但 100+ open issue、维护偏慢；生态/持久化不如 resizable-panels
- **预估成本**：中（作为回退备选保留）

#### Option B-4: `react-split-pane`

- **描述**：老牌分栏库
- **优点**：历史用例多
- **缺点**：已停更，不推荐新接入
- **预估成本**：低但技术债高

#### Option B-5: 自建分隔条

- **描述**：手写 pointer drag + 百分比计算 + localStorage
- **优点**：零依赖
- **缺点**：拖动手柄无障碍/min-max 约束/持久化/窗口 resize 重算全自造，违反「借力最优解」
- **预估成本**：中-高

## 5. Decision

> **一句话拍板**：
> - **D-A** 选 **`@dnd-kit/react@0.4.0` + `@dnd-kit/helpers@0.4.0`**，理由是 2026 React 拖拽事实标准、原生 React 19、新版 API 简洁且有真实仓库可照搬、键盘 sensor + 回滚 + 轴约束内建契合 Linear 气质与 B2 区域内约束。
> - **D-B** 选 **`react-resizable-panels@^4`（锁 `^4.11`）**，理由是 React 可调布局事实标准、持久化内建、v4 多单位支持可直接吃 token px 值省去换算层。

**版本锁定策略（有意不一致）**：dnd-kit 两包用**精确锁**（`0.4.0`，无 caret）——0.x 阶段 minor 升级可能 break API，须显式审阅 changelog 后才升；resizable-panels 用 **caret 锁**（`^4.11`）——已进入稳定 major，minor/patch 向后兼容可自动吃。两种锁法刻意不同，非笔误。

**为什么不选其他**：
- D-A 不选 legacy core/sortable 因为：React 19 官方已转向 `/react` 新范式，选旧范式即选返工
- D-A 不选 react-dnd / pragmatic-dnd 因为：前者样板重维护降、后者偏底层上手成本高于收益
- D-A 不选自建 因为：拖拽是高坑领域（键盘/无障碍/回滚），违反「借力最优解」
- D-B 不选 v3 因为：新引入无理由锁旧 major，v4 持久化更完整
- D-B 不选 allotment 因为：维护活跃度低（保留为回退备选）
- D-B 不选自建/split-pane 因为：停更或重复造轮子

## 6. Consequences

### 正向后果
- 解锁 [[asset-editing-and-adaptive-layout]] P1.4（拖动排序）+ P4（可拖分隔条）开工
- 四路调研沉淀可直接复用：typebot.io 排序范例 + aether 回滚 + resizable-panels `autoSaveId` 持久化
- **消解 px↔% 换算顾虑**（v4 多单位），减少 P4 工作量与失真风险
- 键盘 sensor 同时满足无障碍与 Linear 键盘优先气质

### 反向后果
- 引入 3 个前端依赖（包体 + 维护跟随上游）
- dnd-kit 0.x 版本号 API 可能小变，需关注 changelog
- resizable-panels v4 用例少于 v3，遇坑时社区参考较少
- 拖拽/分隔条交互须持续守 [[02-constitution#B2]]：实现时严防区域内排序逻辑泄漏成跨区拖放
- **NSPanel 依赖未验证**：键盘 sensor + resize-handle focus 依赖 key-window（[[014-nspanel-isa-swizzle]]），P1.5 须实机验证，若失败键盘排序降级为仅指针

### 未来反悔成本
- **代码改造规模**：换拖拽库约 1-3 个组件（MacroGrid 等排序区）+ 排序 hook；换分隔条库约 1 个布局容器
- **数据迁移**：无（排序持久化在各资产表 `order_index` 列，与库无关；布局比例在 localStorage，丢失仅回落默认布局）
- **学习成本**：换库需重学新库交互模型
- **不可逆点**：无——两者都是纯前端工程切换，可干净替换
- **回退备选**：拖拽 → pragmatic-dnd；分隔条 → allotment（px 原生）

---

## 反模式（写完自检）

- ✅ 两个子决策各 Options ≥2（D-A 5 个 / D-B 5 个）
- ✅ Decision 各一句话拍板 + 为什么不选其他
- ✅ Consequences 含未来反悔成本 + 回退备选 + NSPanel 未验证风险
- ✅ 校正 plan v0.2 错误假设（v4 px 支持），不就地改 plan 而在 ADR 记录

## 相关链接

- **触发本决策的文档**：[[asset-editing-and-adaptive-layout]] P1.4 / P4 / [[CLAUDE#§5.3]]
- **被本决策影响的文档**：[[09-tech-stack#§3]]（Accepted 后 +3 依赖）/ [[asset-editing-and-adaptive-layout]] §0 Q7（px 假设校正回流）/ [[05-design-spec]]（px↔% 关系说明）
- **相关 ADR**：前置 [[002-choose-frontend-framework]]（React 19.2）/ [[009-choose-styling]]（CSS Modules token）/ [[014-nspanel-isa-swizzle]]（key-window 前置）
- **调研存档**：`docs/research/2026-06-04-resizable-panels.md`
