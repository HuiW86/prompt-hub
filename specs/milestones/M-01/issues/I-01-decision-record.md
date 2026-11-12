```yaml
id: I-01
milestone: M-01
title: 决策落盘：ADR-031 全景面板为默认视图，并修订宪法 B2
type: docs
risk: R1
depends_on: []
creates:
  - docs/adr/031-panorama-default-view.md
modifies:
  - docs/design/02-constitution.md
  - CLAUDE.md
  - docs/design/CHANGELOG.md
verify: node scripts/doc-governance/index.mjs --config doc-governance.config.mjs
github: 7
human_review: required   # 宪法是人主笔文档，修订须 HuiW86 在 PR 上签字
```

# I-01 决策落盘：ADR-031 与宪法 B2 修订

## 目标

把 2026-11-12 的产品决策写进仓库，使后续实现 Issue 有据可依，并解除全景面板与宪法 B2 的字面冲突。

## 背景

- 使用数据（截至 2026-11-12）：76 条、221 次使用，前 3 条占 50%，44 条从未用过，近 90 天用到 19 条。协议话术自 9 月 25 日后无使用。
- 结论：产品的核心目的是「一眼看到全局，一键贴出，每次都记数」。新增全景面板作为唤起后的默认视图。
- 冲突：`docs/design/02-constitution.md` B2 的证伪条件含「Macro 区展示 AlignmentPhrase → 违反」。全景把协议话术与 Macro 放进同一意图列。
- 用户裁决（规格 D1）：取消界面上的分区，原话「现在拆分的太细了，过度设计了，你看着改吧」。
- 宪法 E1 要求变更先开 ADR；`CLAUDE.md` §5.2 规定宪法由人主笔，所以本 Issue 的修订文字须经用户在 PR 上确认。

## 要做的事

1. 按 `docs/adr/000-template.md` 新建 `docs/adr/031-panorama-default-view.md`，`status: Proposed`，`author: co`，带 `Last reviewed: 2026-11-12`。必须写清：
   - **核心目的**：一眼看到全局，一键贴出，每次都记数。
   - **七条原则**：识别优于回忆；主次由使用数据决定；位置稳定，不自动换位；变暗不消失；取用必须经过面板；按意图分组；用简单方案。
   - **Options（至少这五个）及否决原因**：只显示最常用 9 条（丢全景）；高频词改造成技能或常驻规则（看不到全局、无法统计、不更快）；按用量自动排序（破坏位置记忆）；应用内做 Notion 同步（与 A2 冲突且文件交接未证明不够用）；应用退役只用 Notion（用户确认应用复制更快）。
   - **Decision**：新增全景工作区并设为唤起后的默认视图；原仪表盘保留为「整理」工作区；布局存于 `panorama_placements`，不新增资产类型。
   - **Consequences**：含反悔成本（`panorama_placements` 表与导出 1.5 已在真实库落地后不可降版本）。
2. 修订 `docs/design/02-constitution.md` B2，版本 v1.1 → v1.2，修订历史加一行并链接 ADR-031。修订方向：
   - 保留数据层分离：AlignmentPhrase 不参与 Modifier 拼接、不入 SOP、不与 Macro 互转、不归属 Scene。
   - 删除证伪条件中的「Macro 区展示 AlignmentPhrase」；改为「见到 SOP 步骤含 AlignmentPhrase，或 AlignmentPhrase 被拼进 Composition → 违反」。
   - 增加一句：全景工作区按意图并列展示各类条目，不构成违反。
3. 同步 `CLAUDE.md`：§1 一句话定位补上核心目的；§4.3 删去「Macro 区不展示 AlignmentPhrase」一行并注明例外来源 ADR-031；§6 第 3 条同样改写；§7「ADR 进度」补 031。
4. `docs/design/CHANGELOG.md` 顶部加 2026-11-12 条目。

## 不做

- 不改 `docs/design/01-spec.md`。
- 不改 product-spec、design-spec、prd：这三份的回流在 I-03 合并后另开。
- 不把 ADR 状态写成 Accepted，由用户在 PR 上裁决后再改。

## 完成定义

- 四个文件按上述修改，ADR 含核心目的、七条原则、五个被否决方案。
- `node scripts/doc-governance/index.mjs --config doc-governance.config.mjs` 的 error 数为 0（基线为 0 error / 7 warn，warn 不得增加）。
- PR 描述链接 ADR-031（宪法 E1 的证伪条件）。
