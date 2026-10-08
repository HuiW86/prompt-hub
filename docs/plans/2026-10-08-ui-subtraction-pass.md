---
type: plan
project: prompt-hub
version: v0.1
created: 2026-10-08
status: proposed
author: ai
description: 主界面减法设计 pass 送审稿——四处删减/挪位，超出减法快车道上限，需 omar 一次签字后走八步
---

# 主界面减法设计 pass（送审）

## 要签的决定

**是否同意对主界面做一次「减法 + 挪位」设计 pass（下表四项），签字后按八步回流 [[03-product-spec]] / [[05-design-spec]] 再实施。**

推荐：**同意**。四项都不碰数据、IPC、快捷键行为或协议层/任务层分离，只减少同屏文字噪音、消除一处遮挡。

超出 [[CLAUDE#§5.1.1]] 快车道的原因：一次涉及三处以上，且第 4 项是挪位不是删除。

## 四项

| # | 改什么 | 为什么 | 落点 |
|---|---|---|---|
| 1 | 删区域副标题「· 高频一键入口」「· 原子方法论」「· 场景全景」及 Header 副标题「提示词资产 · 全景仪表盘」 | 解释性文案，用过一次就不再有信息量；区域名本身已足够 | `src/components/primitives/RegionHeader.tsx`（`subtitle`）、`src/components/Header.tsx` |
| 2 | 相位条每格去掉 `⌘1`…`⌘9` 小字 | 格内已有序号方框，同一信息出现两次；状态栏另有快捷键提示 | `src/components/PhaseBar.tsx`（`.shortcut`） |
| 3 | 对齐行标签 `aligned` 改为「对齐」 | 全界面中文，只有这一处英文小写标签 | `src/components/AlignmentPhrases.tsx` |
| 4 | Toast 从右上角挪到底部居中，状态栏上方 | 现位置盖住「调用 / 整理」切换与设置按钮，复制后约 0.8–4 秒内点不到 | `src/components/Toast.module.css`；[[05-design-spec]] §10.3 Toast 行「角落浮条」 |

不在本稿内：层标记 pill「协议层 · 参考」（ADR-020 层级编码，承载语义）、SOP 占位区（omar 2026-08-20 已裁定保留同屏）、Macro 卡 Flame 图标（design-spec §12.4 热度信号）。

## 前后对比

用浏览器 + IPC mock 渲染的同一状态（相位 3，1512×945）。「复制失败」是 mock 剪贴板的产物，真机上是「已复制」。

- 现状：`docs/plans/assets/2026-10-08-ui-pass-before.png`
- 提案：`docs/plans/assets/2026-10-08-ui-pass-after.png`（CSS 覆写模拟，未改源码）

## 同 PR 已修、无需签字的实现缺陷

- Modifier 原子库：hover 才出现的管理簇在隐藏时仍占行内宽度，每行 chip 后留洞、排成参差两列 → 改为浮在 chip 旁，隐藏时不吃指针
- 最近使用：类型徽标宽度随文字变，名称起点不齐 → 徽标统一宽度
- Macro 网格末行卡片被 flex 拉宽（[[HANDOFF]] 第 12 项）→ auto-fill 等宽网格
