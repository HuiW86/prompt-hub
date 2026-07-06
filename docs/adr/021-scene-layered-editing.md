---
type: adr
project: prompt-hub
status: Accepted
description: Scene 编辑分层化——废除全局编辑态，改属性/结构/内容三层就地编辑；拖拽让位按钮移动；scene.color 定性用户内容色（子项待 omar 复核）
---

# ADR-021: Scene 编辑分层化——废除全局编辑态，改三层就地编辑

## 1. 标题与日期

- **标题**：废除 ScenePanel 全局 editMode，拆分为属性面板 + 结构层/内容层就地动作簇
- **日期**：2026-07-06
- **决策者**：omar（2026-07-06 拍板分层方案；scene.color 定性子项待复核，见 §5）
- **影响范围**：`ScenePanel.tsx`（1706→949 行）/ 新增 `ScenePropertiesEditor.tsx`；[[03-product-spec#13.3]] 区域 4 契约重写；[[05-design-spec#12.4]] 用户内容色扩展；[[07-features#3.8]] 回写；[[016-choose-dnd-and-resizable-layout]] 的 dnd 适用范围收缩（Scene 链路退出，MacroGrid / AlignmentPhrases 不变）

## 2. Status

`Accepted`（分层方案 2026-07-06 用户拍板；**scene.color「用户内容色」定性为待 omar 复核的子决策**——否决则降级为仅存储不消费，隔离可回退，见 §5）

## 3. Context

- **触发事件**：用户反馈「Scene 只有一个编辑态、过于抽象」。摸底证实：editMode 实为"改名器"——PRD [[06-prd#6.4]] 已承诺且 `update_scene` IPC 已支持的 icon / color / rolePresets 三字段，UI 零编辑零消费（`ScenePanel.tsx` 原 568-574 行原样透传旧值）
- **业务约束**：Scene 编辑保持 Tauri-only 不经 MCP（[[scene-substage-editing]] D3 决策沿用）；视图网格的话术卡整卡点击是 copy 主动作（spec 九条哲学「复制即完成」），任何编辑 affordance 不得与之冲突
- **技术约束**：后端与 IPC 零改动即可支撑全部字段编辑；@dnd-kit 仍被 MacroGrid / AlignmentPhrases 消费，只能收缩使用范围不能卸载
- **不决策的代价**：统一编辑态心智开销持续存在（「进入编辑模式」→ 找目标 → 退出）；三个已承诺字段永久死在数据层；空子阶段在视图态不可见不可管理

## 4. Options Considered

### Option A: 保留统一编辑态，在 editMode 内补属性表单

- **描述**：维持现有「铅笔进编辑态」模型，把 icon/color/rolePresets 表单塞进结构编辑器 inset。
- **优点**：改动最小；不推翻既有契约（v1.4 / v1.6 两轮落地成果原样保留）。
- **缺点**：编辑态越塞越重，抽象感（用户痛点本体）反而加剧；字段编辑与结构编辑挤在同一 inset，层级混乱。
- **预估成本**：~1 天，但用户反馈的根因未解。

### Option B: 分层就地编辑，废除全局 editMode（选定）

- **描述**：属性层（铅笔→属性面板：name/icon/color/rolePresets + 场景前移/后移/删除）、结构层（子阶段列头 hover/`:focus-within` 动作簇：改名/←→交换/删除 + ghost 新增列）、内容层（话术卡动作簇：原位编辑/↑↓交换/删除 + ghost 添加卡）。编辑什么点什么，无模式切换。
- **优点**：消除模式心智；12 格实体×CRUD 全部就地可达；空子阶段视图态常显可管理；净删 ~750 行。
- **缺点**：视图态动作簇密度上升（hover 显隐缓解）；推翻 v0.11/v0.13 统一编辑态契约需文档回流；ScenePanel 测试全量重写。
- **预估成本**：3 阶段 9 任务（本 plan [[scene-layered-editing]]），已执行完毕。

### Option C: 只补属性面板，保留 editMode 结构编辑

- **描述**：属性字段走新面板，结构/内容编辑仍走编辑态。
- **优点**：风险最低。
- **缺点**：双模型并存——同一实体两套编辑入口，抽象感未除反增；「铅笔」语义含糊。
- **预估成本**：~1.5 天，交付一个更混乱的中间态。

## 5. Decision

> **一句话拍板**：选择 Option B——废除全局 editMode，按属性/结构/内容三层拆分就地编辑入口，能力以按钮等价承接。

**为什么不选其他**：
- 不选 A 因为：用户痛点是「编辑态过于抽象」本身，往编辑态里加东西是反向操作
- 不选 C 因为：双模型并存让「哪里能编辑什么」更难回答

**子决策 1 — 拖拽→按钮移动**：视图网格中 copy 主动作与拖拽 affordance 互斥（拖拽手柄会侵占整卡点击热区、误触率高），P3-6 落地的 SubStage 结构编辑器 dnd 随 editMode 一并移除，以 ←→（子阶段）/ ↑↓（话术组内）相邻交换按钮等价替换，走同一 `reorder_sub_stages` / `reorder_phrases` 链路——**能力不回退，交互形态降级换语义清晰**。[[016-choose-dnd-and-resizable-layout]] 的 dnd 决策在 MacroGrid / AlignmentPhrases 范围内不变。

**子决策 2 — scene.color 定性为用户内容色（待 omar 复核）**：[[019-supersede-flat-visual-anchor]]「放弃颜色本体论」禁的是 chrome 层装饰色；scene.color 与 scene.icon 同属用户内容（[[05-design-spec#12.4]] 先例），只染场景自身图标（tab + 卡头 glyph），不染任何 chrome。6 色预设为组件内 hex 常量（非 token，注释标注 user-content presets），swatch 填充走 inline style，CSS 保持全 token。**omar 否决此定性 → 降级为仅存储不消费**（撤 tab/卡头的 color 注入两处 inline style 即可，隔离可回退）。

## 6. Consequences

### 正向后果
- 编辑心智从「进入模式再找目标」变为「看到什么点什么」；Scene/SubStage/Phrase × CRUD 12 格全部就地可达（测试矩阵逐格钉死）
- PRD §6.4 承诺的 icon / color / rolePresets 三字段首次获得 UI 承载
- `ScenePanel.tsx` 1706→949 行；editMode 及 4 个结构编辑组件、Scene 链路 dnd 代码全数退役
- 空子阶段视图态常显（muted + 添加占位），不再有「不可见不可管理」死区

### 反向后果
- 视图态承载全部编辑 affordance，hover/`:focus-within` 双通道显隐是密度守门员——观感需真机复验（列入 plan 真机批次）
- 「管理话术/管理结构」统一编辑态契约（product-spec v0.11–v0.13 的 §13.3 区域 4）被推翻，文档涟漪见本 ADR §1 影响范围
- 属性面板内部控件走原生焦点序，不进 `data-nav-item` 漫游（设计选择：面板是模态编辑上下文，非全景漫游区），已明记于 product-spec §13.3

### 未来反悔成本
- **代码改造规模**：恢复 editMode 需回滚约 ±1000 行 diff 并再次重写 ScenePanel 测试套件（当前 34 用例按新契约写）
- **数据迁移**：无——本轮零 schema / IPC / MCP 改动，纯 UI 层可逆
- **不可逆点**：无硬不可逆；scene.color 子决策独立可回退（两处 inline style）

## 相关链接

- 触发本决策的文档：[[scene-layered-editing]]（plan，3 阶段 9 任务）；用户反馈 2026-07-06
- 被本决策影响的文档：[[03-product-spec]] v0.14 §13.3 区域 4 / [[05-design-spec]] v0.14 §12.4 / [[07-features]] v1.9 §3.8
- 相关 ADR：[[016-choose-dnd-and-resizable-layout]]（dnd 范围收缩）/ [[019-supersede-flat-visual-anchor]]（颜色本体论豁免边界）/ [[013-alignment-phrases-tab-inclusion]]（编辑模式镜像谱系，AlignmentPhrases 侧不受本 ADR 影响）
