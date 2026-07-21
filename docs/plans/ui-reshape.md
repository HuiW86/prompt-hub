---
type: plan
project: prompt-hub
version: v1.0
created: 2026-07-21
status: in-progress
description: 发布前 UI+组件架构系统性重塑方案（ADR-023）——设计北极星 + 七批次执行清单
---

# UI Reshape — 发布前系统性重塑（ADR-023）

> 分支：`reshape/ui-v2`。Rust 层 / 数据契约 / 宪法约束不动。
> 每批次交付 = 代码 + 测试全绿；测试改动必须是"适配"而非"放水"。

## §1 第一性诊断

产品的第一性需求：**手动挡阶段的认知节奏工具**（哲学二"看见全局 > 操作最快"、哲学四"使用即沉淀"、哲学七"协议/任务分离"）。视觉气质应为"驾驶舱仪表盘"：冷静、全景、层级分明、扫视 1 秒内锚定。

live 诊断（2026-07-21 截图）：设计体系（ADR-018/019/020）方向成立，但实现层系统性失守——

1. 暗 band 未渲染（协议/任务分离失效，live-confirmed bug）
2. elevation 不可感知（灰叠灰，卡片浮不起来）
3. 排版无锚点（63 处 `font:` 简写绕过 preset；可点击 12px；标题/正文/元信息重量趋同）
4. 图标语义混乱（Macro 卡蓝/灰无规则）
5. 空间节奏失衡（上部拥挤、下部大片死空间）
6. UpdaterBanner 失败态占首屏头条
7. 零响应式、零动效语言

## §2 设计北极星（本方案的验收标准）

- **层的语言**：协议层 = 深色岛（两主题恒定），任务层 = 亮 canvas + 白卡 elevation，aside = 安静列。层次由亮度差承担，不靠颜色本体（ADR-019）
- **排版的语言**：ph-page-title 16/600（页面与 Scene 标题）→ ph-region-header 14/600（区域头）→ ph-card-title 14/500 → ph-card-body 14/400（正文升 14，D-3）→ ph-action 13/500（一切可点击文字）→ ph-meta 11 大写宽 tracking / ph-num 11 mono tabular（计数）。扫视锚点 = 标题字重 + 计数 mono 对齐
- **elevation 的语言**：resting = surface-1 + shadow-1；hover = lift-1 + shadow 过渡；selected = surface-3 fill。禁 glow / 多层影（ADR-019）
- **动效的语言**：全部 ≤200ms（C1）；唤起入场 fade 160ms；hover/press 120ms；prefers-reduced-motion 全部关闭
- **失败态的语言**：后台任务失败不占头条——降级为 StatusBar 级低噪提示

## §3 执行批次

| # | 批次 | 内容 | 状态 |
|---|---|---|---|
| W1 | 排版基础 | preset 补 ph-action / ph-page-title / ph-num；body 13→14；`.btn` 12px 根因修复 | in-progress |
| W2 | 排版迁移 | 63+1 处 `font:` 简写 → composes（审计 §4 为映射表） | pending |
| W3 | 视觉层级 | 暗 band bug 修复；elevation 落地；灰叠灰清理；图标语义统一；UpdaterBanner 降噪 | pending |
| W4 | 组件架构 | ScenePanel 拆分；焦点恢复基建（A1-05）；promptStore 模块化（API 不变） | pending |
| W5 | 响应式底线 | editorActions wrap；SettingsModal / SearchOverlay 降级；184px token 语义拆分 | pending |
| W6 | 动效语言 | 入场 / hover / 过渡统一 + reduced-motion | pending |
| W7 | 验证回流 | 全量测试 + 真机截图前后对比 + design-spec 回流（draft 人审）+ checkpoint | pending |

## §4 不做的事

- 不动 Rust 三 crate / IPC 契约 / SQLite schema
- 不动 spec / constitution（人主笔）
- 不做整页三档紧凑响应式（只堵底线，同原批次 D 边界）
- 不做 Phrase soft-delete（D-5 独立立项不变）
