```yaml
id: I-03
milestone: M-01
title: 全景视图：三层显示、数字键、打字筛选，并设为默认工作区
type: feature
risk: R1
depends_on: [I-02]
creates:
  - src/utils/panorama.ts
  - src/utils/__tests__/panorama.test.ts
  - src/stores/panoramaStore.ts
  - src/components/panorama/PanoramaView.tsx
  - src/components/panorama/PanoramaView.module.css
  - src/components/__tests__/PanoramaView.test.tsx
modifies:
  - src/stores/appStore.ts
  - src/components/Header.tsx
  - src/layouts/Dashboard.tsx
verify: pnpm test -- src/utils/__tests__/panorama.test.ts src/components/__tests__/PanoramaView.test.tsx && pnpm lint && pnpm build
github: 9
human_review: standard
```

# I-03 全景视图

## 目标

用户唤起后在一屏内看到全部条目，按一个键或点一下把它贴出去，打字能筛选。对应规格场景 S1、S2、S3。

## 背景

- 核心目的：一眼看到全局，一键贴出，每次都记数。面板是菜单，看到了才想得起来，所以**全部条目必须同时可见**，主次靠层级区分，不靠隐藏。
- 设计稿：画布「Prompt Hub 聚焦版」的「全景面板」画板。本文件已写明全部结构与规则，没有画布也能实现。
- 现状：工作区切换在 `src/stores/appStore.ts`（`workspace: "prompts" | "websites"`）与 `src/components/Header.tsx`；`src/layouts/Dashboard.tsx` 按工作区渲染。所有复制统一走 `src/hooks/useCopy.ts` 的 `copy(content, input, flashId?)`，它负责写剪贴板、提示、记数，以及整理态下不收起窗口。
- 数据：五类条目已在 `usePromptStore` 中；布局来自 I-02 的 `ipc.listPanoramaPlacements()`，类型 `PanoramaPlacement`、`PanoramaAssetKind`、`PanoramaGroupId` 见 I-02「接口」。

## 接口

`src/utils/panorama.ts`（纯函数，无 IPC、无 store）：

```ts
export type PanoramaTier = "pinned" | "active" | "dormant";
export type PanoramaColumnId = PanoramaGroupId | "ungrouped";
export interface PanoramaItem {
  kind: PanoramaAssetKind;
  id: string;
  name: string;
  content: string;      // 复制出去的正文
  usageCount: number;
  lastUsedAt: string | null;
  tier: PanoramaTier;
  isNew: boolean;
  pinSlot: number | null;
}
export interface PanoramaColumn {
  id: PanoramaColumnId;
  title: string;
  items: PanoramaItem[]; // 已按 pinned(按 pinSlot) → active → dormant 排好
  activeCount: number;   // pinned + active + isNew 的条数
}
export interface PanoramaModel {
  columns: PanoramaColumn[]; // align, diverge, converge, execute, polish, retain, 以及非空时的 ungrouped
  strip: PanoramaColumn[];   // cue, tool
  bySlot: Record<number, PanoramaItem>;
}
export function buildPanorama(input: {
  macros: Macro[]; phrases: Phrase[]; alignmentPhrases: AlignmentPhrase[];
  modifiers: Modifier[]; compositions: Composition[];
  placements: PanoramaPlacement[]; now: Date;
}): PanoramaModel;
export function matchesFilter(item: PanoramaItem, query: string): boolean;
```

`src/stores/panoramaStore.ts`：`placements`、`load()`、`setPlacement(input)`（调用 I-02 的两个 IPC；I-04 复用 `setPlacement`）。

## 规则

分层（由 `buildPanorama` 现算，不落库）：

| 层 | 条件 |
|---|---|
| `pinned` | 有 `pinSlot` |
| `active` | 无 `pinSlot`，且 `lastUsedAt` 距 `now` 不超过 90 天 |
| `isNew` | `usageCount === 0` 且 `createdAt` 距 `now` 不超过 14 天；显示在 active 层并带「新」标 |
| `dormant` | 其余 |

分列：有 `groupId` 的按 `groupId`；没有的按默认规则。默认规则只有一条：协议话术按相位 ID 映射，其余进 `ungrouped`。

| 相位 ID | 列 |
|---|---|
| `phase-understand` | align |
| `phase-diverge` | diverge |
| `phase-converge`、`phase-plan` | converge |
| `phase-generate`、`phase-execute` | execute |
| `phase-iterate` | polish |
| `phase-distill` | retain |
| `phase-live` | cue |

列标题：对齐与理解、发散与调研、收敛与方案、执行与验收、打磨与表达、沉淀、未分组；底部：中途口令、工具。

排除：`deprecated === true` 的条目不进入模型（软删除的条目 store 里本来就没有）。

显示：

- 六列等宽网格，底部一排是 `strip`，再下面是选中条目的预览条（名称、正文单行截断、次数与最近使用日期）。
- `pinned`：卡片，含数字键徽标、加粗名称、次数、一条宽度为 `usageCount / 全库最大 usageCount` 的用量条。
- `active`：单行，亮色，右侧次数或「新」标。
- `dormant`：分隔线以下，小一号，暗色，不显示次数。
- 列标题右侧显示 `activeCount / items.length`。
- 一屏放不下时：从最长的列开始，把 `dormant` 层截断为「还有 N 条」，直到不出现纵向滚动条。`pinned` 与 `active` 永不截断。
- CSS 只用 `src/styles/tokens.css` 里的 token，不写裸 px、裸 hex（`CLAUDE.md` §4.1，`src/styles/token-gate.test.ts` 会拦）。

复制：一律调用 `useCopy()`。`RecordUsageInput.source` 沿用各类型现有取值，不新增：Macro 与 Modifier 用 `macro_area`，场景话术用 `scene`，Composition 用 `composition`，协议话术用 `alignmentUsageSource(phrase, "phase_bar")`（`src/ipc/usageSource.ts`，口令会被记成 `live_cue`）。各类型的 `targetType` 与正文拼法照抄 `src/components/MacroGrid.tsx`、`src/components/scene/ScenePanel.tsx`、`src/components/AlignmentPhrases.tsx` 里现有的调用。

键盘（只在全景工作区且没有编辑器或弹窗打开时生效）：

- 筛选框为空时，裸数字键 `1`–`9` 复制对应常用位；该位置为空则无事发生。
- 其他可打印字符进入筛选框。筛选框非空时数字键是输入。
- 筛选时不匹配的条目变暗，所有条目位置不变。匹配范围是名称与正文，不区分大小写。
- `↵` 复制选中条目；没有选中时复制按列从左到右、从上到下的第一个匹配。
- `↑` `↓` `←` `→` 在可见条目间移动选中。`Esc` 先清空筛选，再按一次才收起窗口（沿用现有 Esc 行为）。
- 不得拦截带 `⌘` 的组合键：`⌘1`–`⌘9` 仍是相位切换（`src/App.tsx`）。
- 每次唤起（Rust 发 `wake` 事件，见 `src/App.tsx`）清空筛选与选中。

默认工作区：`workspace` 类型改为 `"panorama" | "prompts" | "websites"`，初始值 `"panorama"`。Header 的工作区导航增加「全景」并排第一，原「提示词」一项改名为「整理」。

## 不做

- 不做分组与常用位的修改入口（归 I-04）。没有任何布局数据时，协议话术按相位归列，其余全部落在「未分组」，这是预期行为。
- 不做复盘页。
- 不改原仪表盘的任何组件。

## 完成定义

- `panorama.test.ts` 覆盖：四种层级判定的边界（恰好 90 天、恰好 14 天）、相位映射九个 ID、`groupId` 覆盖默认规则、`deprecated` 被排除、`bySlot`、`matchesFilter`。
- `PanoramaView.test.tsx` 覆盖：S1 第 5、6 步的渲染断言；S2（按 `1` 触发一次 `copy`，参数正文与 `source` 正确；点击行同理）；S3（输入后不匹配项带变暗标记且 DOM 顺序不变；`↵` 复制第一个匹配；筛选非空时按数字不触发复制）；`⌘1` 不被拦截；`wake` 后筛选清空。
- 默认工作区为全景的断言更新进 `src/App.test.tsx` 中受影响的用例。
- `pnpm test`、`pnpm lint`、`pnpm build`、`pnpm exec prettier --check src` 全部通过。
- PR 描述注明：唤起性能与一屏无滚动两项 jsdom 验不了，留待规格「收尾」的真机步骤。
