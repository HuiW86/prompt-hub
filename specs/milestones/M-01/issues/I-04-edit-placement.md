```yaml
id: I-04
milestone: M-01
title: 在全景里调整分组与常用位
type: feature
risk: R1
depends_on: [I-02, I-03]
creates:
  - src/components/panorama/PlacementMenu.tsx
  - src/components/panorama/PlacementMenu.module.css
  - src/components/__tests__/PlacementMenu.test.tsx
modifies:
  - src/components/panorama/PanoramaView.tsx
verify: pnpm test -- src/components/__tests__/PlacementMenu.test.tsx src/components/__tests__/PanoramaView.test.tsx && pnpm lint && pnpm build
github: 10
human_review: standard
```

# I-04 在全景里调整分组与常用位

## 目标

用户可以决定每条条目放在哪一列、占哪个常用位。位置由用户指定，应用不自动换位。

## 背景

- 原则：位置稳定。常用位和分组一旦定下就不随用量变化，用户靠位置记忆找词。
- I-03 完成后，没有布局数据的条目（Macro、场景话术等）都落在「未分组」列，常用位全空。本 Issue 提供把它们归位的入口。
- 现状：`useSettingsStore` 的 `interactionMode` 有 `"organize"`（整理态），Header 上有 `ModeToggle`。整理态下复制不收起窗口。
- 可用接口：`usePanoramaStore().setPlacement(input: PanoramaPlacement)`（I-03），底层是 I-02 的 `setPanoramaPlacement`，抢占已占用的常用位由后端处理。

## 要做的事

1. 仅在整理态下，全景里每个条目可打开一个「位置」菜单（`PlacementMenu`），入口两个：选中条目后按 `M`；或条目上的「位置」按钮（整理态才显示）。
2. 菜单内容：
   - 「分组」：八个选项（六个意图列、中途口令、工具）加「按默认」。
   - 「常用位」：1–9 九个选项加「不占用」。已被占用的位置旁显示占用者名称。
3. 选择后立即调用 `setPlacement` 并关闭菜单，全景随返回的完整列表刷新。选了已被占用的常用位时，原占用者让出，并出现一条带「撤销」的提示（用 `useToastStore`，撤销 = 对两条各调用一次 `setPlacement` 恢复原值）。
4. 整理态下的快捷方式：选中条目后按 `⌥1`–`⌥9` 直接指定常用位，`⌥0` 取消常用位。
5. 菜单用原生 `popover` 锚定在条目上，沿用 `src/hooks/useAnchoredPosition.ts`，关闭后焦点回到该条目。

## 不做

- 不做拖拽。
- 不做批量操作。
- 不在调用态（非整理态）显示任何编辑入口。
- 不改分组的名称、数量与顺序，八个分组是固定的。

## 完成定义

- `PlacementMenu.test.tsx` 覆盖：改分组后调用参数正确；选「按默认」传 `groupId: null`；占用提示显示占用者名称；抢占后出现撤销提示，撤销恢复两条原值；`⌥3` 指定常用位、`⌥0` 取消；调用态下按 `M` 无事发生且无「位置」按钮。
- `PanoramaView.test.tsx` 补一条：改分组后条目出现在新列。
- `pnpm test`、`pnpm lint`、`pnpm build`、`pnpm exec prettier --check src` 全部通过。
