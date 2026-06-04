---
title: "react-resizable-panels 多区域可调布局选型调研"
date: 2026-06-04
tags: [research, layout, resizable-panels, frontend, adr-016]
---

# Research: React 多区域可调布局（可拖分隔条 + 比例持久化 + px↔% 换算）

> **Goal:** 为 prompt-hub Dashboard「P4 可拖分隔条」选型，验证 plan v0.2 倾向的 `react-resizable-panels@v4`，并校正其中关于「v4 仅百分比 / 无 px」的假设。支撑 ADR-016。
> **Date:** 2026-06-04
> **Depth:** Quick Scan（GitHub API 硬数据 + 官方 CHANGELOG 直读 + Web 交叉验证）
> **Dimensions:** Open-Source Landscape, Best Practices

## TL;DR

1. **维持选型 `react-resizable-panels`，但锁到具体版本 `^4.11`（latest 4.11.2，2026-05-23），不写 `^4` 泛指。** 它是 2026 React 可调布局事实标准（5.3k★ / MIT / 每周活跃发版 / shadcn 底座），作者 Brian Vaughn（React DevTools 作者）。[HIGH]
2. **校正 plan v0.2 的关键假设**：v4 **并非「仅百分比、无 px」**。官方 4.0.0 release note 原文：「Version 4 offers more flexible size constraints — supporting units as pixels, percentages, REMs/EMs, and more.」v4 反而**扩展**了单位支持。所谓「移除 px」指的是移除了 v2 时代复杂的 `defaultSizePixels`/`minSizePixels` **后缀属性体系**，改为「数字=px、无单位字符串=百分比、`"px"`/`"rem"`/`"vh"` 后缀字符串=对应单位」的统一解析约定。**px↔% 换算这个顾虑大部分可消解**——可直接给 token px 值（如 `minSize="240px"`），库内部用 ResizeObserver 校验。[HIGH]
3. **`useDefaultLayout` hook 确实存在**（CHANGELOG 4.8.0 明确，且能自动迁移 legacy 布局到 v4 格式）。plan v0.2 此处正确，但有一处 web 来源误称「该 hook 不存在」——以官方 CHANGELOG 为准，**存在**。[HIGH]
4. **找到强相关真实仓库 `dannysmith/tauri-template`**：Tauri v2 + React 19.2 + Zustand 5 + react-resizable-panels，与 prompt-hub 技术栈几乎同构——但它**锁 v3（`^3.0.6`）而非 v4**。这是一个值得注意的反向信号：成熟模板仍在用 v3。[MEDIUM]

## Current State

prompt-hub 现状（`src/layouts/Dashboard.tsx`）：三列固定 CSS Grid（`panoramaGrid` → `MacroGrid` / `ScenePanel` / `col3`），**无任何可调能力**，未装任何布局库。技术栈：React 19.2 + Zustand 5 + Tauri 2 + CSS Modules，CSS 强制 token（[[CLAUDE#§4.1]] 禁裸 px/hex/ms）。plan `asset-editing-and-adaptive-layout.md` v0.2 已把可拖分隔条排到 **P4**，并倾向 `react-resizable-panels@^4` + localStorage 持久化，待 ADR-016 锁定后开工。本调研即为 ADR-016 补证据。

## Open-Source Landscape

### Tier 1: Deep Dive

#### react-resizable-panels（推荐）
- **Repo:** https://github.com/bvaughn/react-resizable-panels
- **Stars:** 5,290 | **License:** MIT | **Latest:** 4.11.2（2026-05-23）| **Open issues:** 0
- **Last push:** 2026-06-02（活跃）| **Author:** Brian Vaughn（React DevTools 作者）
- **Commit Activity:** 极活跃，2026-03 至 05 两个月发了 4.7.x→4.11.x 共 ~15 个版本

**Architecture:** 组件式 API。v4 三件套 `Group`（容器）/ `Panel`（可调区域）/ `Separator`（分隔条，`role="separator"` + 完整 WAI-ARIA）。持久化经 `useDefaultLayout({ groupId, storage })` hook 拿 `defaultLayout` + `onLayoutChange`。尺寸单位：数字→px，无单位字符串→%，`"33%"`/`"240px"`/`"1rem"`/`"50vh"` 后缀字符串→对应单位。

**Strengths:**
- 2026 事实标准，shadcn/ui `Resizable` 即其封装；生态背书最强 [HIGH]
- 键盘可达 + ARIA live 播报开箱即用——契合项目 [[ADR-013]] Tab cycle 无障碍要求 [HIGH]
- v4 单位灵活（px/%/rem/vh），**直接消解 plan v0.2 的 px↔% 换算顾虑**：可给 `minSize="240px"`（token 值），无需手写换算 util [HIGH]
- `onLayoutChanged`（pointer release 后才触发）专为持久化设计，避免拖动中每帧写 localStorage [HIGH]
- 0 open issues、每周发版——维护健康度极高 [HIGH]

**Weaknesses:**
- v4 是 2026 新主版本，部分生态（shadcn-ui#9197）仍在补 v4 兼容；社区示例多数还是 v3 `PanelGroup`/`PanelResizeHandle` 写法，迁移时易抄到旧 API [MEDIUM]
- 默认无样式 handle，分隔条视觉需自写 CSS（对项目反而是优点：可全 token 化）[HIGH]
- 持久化 SSR 有 flicker 风险——但 prompt-hub 是 Tauri CSR，**不受影响** [HIGH]

**Verdict:** 推荐，锁 `^4.11`。是 P4 的最优解。 [HIGH]

#### allotment（备选）
- **Repo:** https://github.com/johnwalley/allotment
- **Stars:** 1,251 | **License:** MIT | **Latest:** v1.20.5（2025-12-19）| **Open issues:** 100
- **Last push:** 2026-06-02

**Architecture:** 基于 VSCode 的 split-view sash 实现移植，`<Allotment>` + `<Allotment.Pane minSize maxSize snap>`，**原生 px min/max**（不需换算），ref 暴露 `reset`/`resize`。

**Strengths:**
- min/max 原生 px——若坚持 px 思维，allotment 比 resizable-panels 更直接 [MEDIUM]
- VSCode 同源体验，sash 拖拽手感成熟 [MEDIUM]

**Weaknesses:**
- 100 个 open issue，发版节奏（2025-12 后无 release）明显慢于 resizable-panels [MEDIUM]
- 需 import 自带 CSS，且「容器无显式高度→pane 高度塌成 0」是高频踩坑 [MEDIUM]
- 生态背书弱于 resizable-panels（shadcn 选了后者）[HIGH]

**Verdict:** 合格备选，若 v4 px 方案实测不顺可回退到此。但综合不如 resizable-panels。 [MEDIUM]

### Tier 2: Overview

| Project | Stars | License | Last Release | One-liner |
|---------|-------|---------|-------------|-----------|
| react-split-pane (`tomkp`) | 3,386 | MIT | — | 老牌简单分隔，但**长期未活跃维护**，新项目不推荐 [MEDIUM] |
| react-resizable-layout (`RyoSogawa`) | 112 | MIT | 2025-09（停滞）| headless（`Resizable` + `useResizable`），轻量但小众、半年无更新 [MEDIUM] |
| Windmill-City/resizable-panels | 1 | MIT | 无 release | headless、**原生支持 px+ratio 双模式**，VSCode 风——但仅 1★、无 release，**生产风险过高，跳过** [HIGH] |
| react-grid-layout | — | — | 活跃 | 网格拖拽（dashboard 卡片），**非分隔条场景**，与本需求不符 |
| react-dock | — | — | — | docking/浮动面板（IDE 拖拽停靠），超出本需求且违反 [[02-constitution#B2]] 物理分离，不选 |

## Best Practices

**1. 持久化用 `onLayoutChanged`（不是 `onLayout`）**：`onLayout` 拖动中每帧触发，`onLayoutChanged` 仅在 pointer 释放后触发，写 localStorage 选后者。布局是 `number[]`（每项 1–100 的百分比），`JSON.stringify` 存盘即可。[HIGH]

**2. v4 持久化优先用 `useDefaultLayout` hook**：`const { defaultLayout, onLayoutChange } = useDefaultLayout({ groupId: "dashboard", storage: localStorage })`，比 v3 `autoSaveId` 字符串更显式、storage 可注入（利于测试 mock）。4.8.0 起还能自动迁移老布局格式。[HIGH]

**3. 条件渲染的 Panel 必须显式 `id` + `order`**：prompt-hub 的「📥 草稿」tab 是 N>0 才显示的条件 Panel，不给稳定 `id`/`order` 会导致布局错乱——plan v0.2 P4.1 已记录此点，调研确认必须做。[HIGH]

**4. px↔% 换算的真实处理方式**：v4 下**不必手写换算 util**。直接对约束用单位字符串（`minSize="240px"` 取项目 `--space-*` 等价 px），库内 ResizeObserver 自动校验；只有 `defaultSize` 持久化值仍存百分比数组。plan v0.2 「窗口 resize 时换算 stale，须监听 resize 重算」的顾虑，**在交给库处理 px 约束后大幅减轻**——ResizeObserver 是库内部职责。[HIGH]

**5. NSPanel key-window 前置（项目特有）**：分隔条键盘聚焦依赖窗口可成 key window（[[ADR-014]] `canBecomeKeyWindow` override）。社区无 NSPanel × resizable-panels 公开冲突案例，但需在 NSPanel 实测 `Separator` 聚焦 + 键盘 resize 是否生效。[UNVERIFIED]（无公开数据，须项目自测）

## Recommendations

### Recommended Path
**`react-resizable-panels@^4.11`**（v4 三件套 `Group`/`Panel`/`Separator` + `useDefaultLayout` + `onLayoutChanged` 持久化到 localStorage）。理由：生态事实标准、与项目栈（React 19 / CSR / 无障碍）契合、v4 单位灵活已消解 px↔% 主要顾虑、维护极活跃。

### Alternatives Considered
- **allotment**：原生 px min/max 更直接，但维护节奏慢、open issue 多、生态背书弱——列为回退备选。
- **维持 v3（`^3.0.6`）**：`dannysmith/tauri-template` 同构栈正用 v3，社区示例也多 v3。**值得 ADR-016 显式对比**——v3 API 更稳定、文档/示例更多，代价是没有 `useDefaultLayout` 的干净持久化、单位体系是旧后缀式。若团队想要「最多踩坑前人、最少迁移风险」，v3 是保守选项。
- **headless（react-resizable-layout / Windmill-City）**：完全自控样式但小众/无 release，引入维护风险，不值当。

### Open Questions
1. **v3 vs v4 终裁**：ADR-016 需在「v4 更干净的 `useDefaultLayout` + 灵活单位」与「v3 更多社区示例 + tauri-template 实证」之间显式取舍。本调研倾向 v4，但 v3 的实证背书（同构栈在产）不可忽视。
2. **NSPanel 下 `Separator` 键盘聚焦 + resize 是否生效**——无公开数据，必须项目实测（关联 ADR-014）。
3. token px 值喂给 `minSize="240px"` 时，与 CSS Modules token（`--space-*` 是 CSS 变量、JS 拿不到计算值）如何对齐——可能仍需一个 JS 侧 px 常量映射，但远轻于「全量 px↔% 换算 util」。

### Suggested Next Steps
1. ADR-016 落 v3 vs v4 对比表（用本调研数据）+ 锁定结论。
2. P4.1 装包后，先在 NSPanel 实测 `Separator` 键盘聚焦（验证 Open Question 2），再写业务。
3. 原型验证 `minSize="240px"` 路径，确认能否免写换算 util（验证 TL;DR #2）。

## Adoption Decisions

### Industry Standard Layers

| 行业标准分层 | 我们的现状 | Gap |
|-------------|-----------|-----|
| 可调布局库（拖拽 resize 引擎）| 无，三列固定 Grid | 需引入 `react-resizable-panels@^4` |
| 分隔条无障碍（`role="separator"` + ARIA + 键盘 resize）| 无 | 库开箱提供，但 NSPanel 下须实测聚焦 |
| 布局持久化（重启恢复比例）| 无 | `useDefaultLayout` + localStorage + `onLayoutChanged` |
| 尺寸单位约束（min/max/default）| token px 思维 | v4 支持 px 字符串，直接喂 token 等价 px，免换算 util |
| 默认/重置基线（reset 回归一致布局）| 无 | 库 ref `setLayout` + 双击 Separator 复位（可 `disableDoubleClick` 关）|

核心视角：行业用「组件式 resize 库 + 库内 ResizeObserver 处理 px 约束 + 库内持久化 hook」，我们差在整层布局引擎；引入后大部分能力（无障碍/单位/持久化/复位）由库兜底，自研面收窄到 token 对齐 + NSPanel 验证。

### Adoption Decision Table

| # | 发现 | 决策 | 作用域 | 理由 |
|---|------|------|--------|------|
| 1 | `react-resizable-panels` 是 2026 事实标准（5.3k★/MIT/活跃/shadcn 底座）| 采纳 | 全项目 P4 | 生态背书 + 栈契合，最优解 |
| 2 | 锁 `^4.11`（latest 4.11.2）而非泛 `^4` | 采纳 | 全项目 | 避免 minor 漂移；ADR 记录确切版本 |
| 3 | v4 **支持 px/rem/vh 单位**（非「仅百分比」）| 采纳（校正 plan v0.2 假设）| 全项目 | 官方 4.0.0 原文证伪；消解 px↔% 换算主顾虑 |
| 4 | `useDefaultLayout` hook 存在且自动迁移 legacy | 采纳 | 全项目 | CHANGELOG 4.8.0 证实；比 autoSaveId 更显式可测 |
| 5 | 持久化用 `onLayoutChanged`（非 `onLayout`）| 采纳 | 全项目 | release 后才写盘，避免每帧 IO |
| 6 | 条件渲染 Panel（📥 草稿 tab）须显式 `id`+`order` | 采纳 | 全项目 | 防布局错乱，plan 已记录 |
| 7 | px↔% 换算 util | 不采纳 / 改为「按需 token px 常量映射」| 全项目 | 交给库 ResizeObserver；只在 token→JS px 对齐处保留极薄映射 |
| 8 | allotment（原生 px min/max）| 延后（回退备选）| P4 若 v4 px 实测受阻 | 维护慢 + open issue 多 + 背书弱，仅作 fallback |
| 9 | 维持 v3（tauri-template 同构栈实证）| **延后决策 → 交 ADR-016 终裁** | P4 | v3 示例多/更稳但持久化不如 v4；需人审权衡 |
| 10 | headless 库（react-resizable-layout / Windmill-City）| 不采纳 | 全项目 | 小众/1★/无 release，维护风险高 |
| 11 | react-dock / react-grid-layout | 不采纳 | 全项目 | 场景不符（停靠/网格），且 dock 违反 [[02-constitution#B2]] 物理分离 |

## Sources
- [bvaughn/react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) — 官方 repo（5.3k★/MIT）
- [v4 CHANGELOG（4.0.0 原文 + useDefaultLayout 4.8.0）](https://github.com/bvaughn/react-resizable-panels/blob/main/CHANGELOG.md)
- [react-resizable-panels npm](https://www.npmjs.com/package/react-resizable-panels) — latest 4.11.2
- [johnwalley/allotment](https://github.com/johnwalley/allotment) — 备选（1.25k★）
- [dannysmith/tauri-template](https://github.com/dannysmith/tauri-template) — Tauri2+React19+Zustand5+resizable-panels v3 同构栈实证
- [Windmill-City/resizable-panels](https://github.com/Windmill-City/resizable-panels) — headless px+ratio 双模（1★，跳过）
- [shadcn-ui/ui#9197 — v4 兼容 issue](https://github.com/shadcn-ui/ui/issues/9197)
- [LogRocket: Essential tools for React panel layouts](https://blog.logrocket.com/essential-tools-implementing-react-panel-layouts/)
- [npm trends: allotment vs react-resizable vs react-split-pane](https://npmtrends.com/allotment-vs-react-resizable-vs-react-split-pane-vs-react-splitter-layout)
