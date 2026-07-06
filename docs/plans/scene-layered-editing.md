# Scene 分层编辑（废除全局编辑态）
Status: done  # 代码 9/9 收口（2026-07-06）；共创文档（ADR-021 / product-spec v0.14 / design-spec v0.14）待 omar 人审，scene.color 定性为唯一待裁项
Progress: 9/9
Date: 2026-07-06

## 目标

把 ScenePanel 的单一 `editMode` 拆成三层就地编辑——属性层（铅笔 → 属性面板，补齐 PRD §6.4 已承诺但 UI 全死的 icon / color / rolePresets）、结构层（子阶段列头就地改名/移列/删）、内容层（话术卡 hover 就地编辑/移动/删/新增）。编辑什么点什么，取消"进入编辑模式"的心智开销。后端与 IPC 零改动（`update_scene` 本就支持全字段）。

Journey: [[03-product-spec#13.3]] 区域 4。

**非目标**：`visible` 字段编辑；rolePresets 在 Composition 的消费（06-prd.md:577 未来项）；跨列拖拽移动 Phrase（改分组走话术编辑器下拉）；后端 / IPC / MCP 改动（Scene 编辑保持 Tauri-only）。

## 任务清单

### 阶段 1 — 属性层（editMode 暂不动，无回退风险）

- [x] 1. 新建属性面板组件（`src/components/ScenePropertiesEditor.tsx` + `__tests__/ScenePropertiesEditor.test.tsx`）：name 必填 Input；icon = SCENE_LUCIDE 6 预设按钮 + emoji 自由输入 + 「无」；color = 组件内 6 色预设 swatch + 清除（hex 常量注释标注"用户内容预设，非 chrome token"）；rolePresets = `Chip` primitive + × 删除 + 回车添加（Enter 带 IME `isComposing` 守卫）；底部动作行收编 场景前移/后移/删除（ConfirmInline）
- [x] 2. ScenePanel 接线（`src/components/ScenePanel.tsx`）：卡头铅笔改开属性面板；tabs 行尾加「＋ 新建场景」（`data-nav-item`）；`handleCreateScene` 跳转后自动开属性面板（替代 keepEdit 行内改名）
- [x] 3. 消费锚点：tab 与卡头 `SceneIcon` 注入 `style={{ color: scene.color ?? undefined }}`；卡头 meta 行渲染 rolePresets chips（`ScenePanel.tsx` + `ScenePanel.module.css`）
- [x] 4. 阶段 1 测试：属性面板保存 payload 全字段断言（icon/color/rolePresets 不再原样透传）+ swatch/chip 交互 ≥6 用例；`pnpm test` 全绿、原编辑态功能不回退

### 阶段 2 — 结构层 + 内容层就地化，废除 editMode

- [x] 5. 子阶段列头动作簇（hover + `:focus-within` 双通道显隐）：✎ 行内改名 / ←→ 相邻交换（`reorder_sub_stages`）/ 🗑 ConfirmInline（删除解绑提示）；网格尾「＋ 新增子阶段」ghost 列；`groupBySubStage` 视图态恒 `includeEmpty`（空列 muted + 「＋ 添加话术」占位）
- [x] 6. 话术卡动作簇：✎ 原位换 `PhraseEditor` / ↑↓ 组内交换（`reorderPhrases`）/ 🗑 ConfirmInline，全部 `stopPropagation` 不触发 copy；每列底「＋ 添加话术」ghost 卡预填 subStageId
- [x] 7. 删除 editMode 全链路：`SceneStructureEditor` / `EditablePhraseGroup` / `SortablePhraseRow` / `SortableSubStageRow` 及 @dnd-kit import（依赖不卸载，MacroGrid 还在用）；场景切换重置 effect 简化；所有新按钮 `data-nav-item tabIndex={-1}` 进漫游序列
- [x] 8. 阶段 2 测试重写（`__tests__/ScenePanel.test.tsx`）：按实体×CRUD 矩阵验收——Scene/SubStage/Phrase × Create/Update/Delete/Reorder 12 格每格都有就地入口断言；`pnpm test` + `pnpm lint` + `pnpm build` 全绿；每个动作按钮键盘箭头可达

### 阶段 3 — 文档八步回流

- [x] 9. 起草 ADR-021（Scene 编辑分层化，推翻 v0.11/v0.13 统一编辑态契约，明记 拖拽→按钮移动 理由）→ 03-product-spec §13.3 区域 4 三层契约重写 + 05-design-spec 用户内容色条目 + 07-features 回写 + CHANGELOG；doc-governance 0 error；共创文档等 omar 人审

## 关键决策

- **取消全局编辑态，按层拆分就地入口**（用户 2026-07-06 拍板）；字段范围 icon + color + rolePresets，不含 visible
- **color 定性为用户内容色**：绕开 ADR-019"放弃颜色本体论"的 chrome 禁令（先例：design-spec §12.4 Scene icon 是用户内容），只染场景自身图标不染 chrome；omar 否决则降级为仅存储——本方案唯一待人审的设计判断，隔离在任务 3 + 任务 9，可独立回退
- **拖拽 → 按钮移动**：copy 主动作与拖拽 affordance 在视图网格互斥，P3-6 落地的 dnd 以 ←→/↑↓ 按钮等价替换（能力不回退）
- **「新建场景」迁至 tabs 行尾「＋」**，属性面板收编容器级操作（前移/后移/删除）
- 空子阶段视图态常显（muted）——否则废除编辑态后空子阶段永不可见不可管理；视图密度变化列入真机复验批次
