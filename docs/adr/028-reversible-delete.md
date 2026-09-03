---
type: adr
project: prompt-hub
status: Accepted
description: 删除改为可撤销——资产行原地软删不搬走，保住 id / created_at / order_index / usage 历史；新增第七道源码级闸门堵住「忘记过滤」这一类坑；六处「永久删除？」确认框换成一键 + 撤销 toast；废纸篓只由用户手动清空
related:
  - 06-prd
  - 03-product-spec
  - 10-ops-spec
  - 022-cross-scene-phrase-move
  - 025-unified-anchored-editing
  - 02-constitution
---

# ADR-028: 删除可撤销（原地软删除 + 源码级闸门 + 手动清空的废纸篓）

## 1. 标题与日期

- **标题**：删除从硬删除改为**原地软删除**——资产行留在原表只是不再露面，恢复是一次 UPDATE；读路径的过滤由新增的第七道源码级闸门强制；六处行内「永久删除？」确认框拆除，改为一键删除 + 撤销 toast；废纸篓不自动过期，只由用户手动清空
- **日期**：2026-09-03
- **决策者**：omar（2026-09-03 拍板）；起草：Claude（🤝 共创文档，见 [[CLAUDE#§5.2]]）
- **影响范围**：
  - **数据**：migration `0013`（`user_version` 12→13），七张资产表加 `deleted_at`；重建 `idx_alignment_phrase_one_default_per_phase`
  - **代码**：`repo-write/src/{scenes,sub_stages,phrases,macros,modifiers,compositions,alignment_phrases}.rs` 七处 `DELETE FROM` 改 UPDATE；`repo-core/src/repo.rs` 五处列表读补过滤；新增 `restore_asset` / `list_trash` / `purge_trash` 三个 IPC（53→56）；`src/stores/toastStore.ts` 修撤销被顶掉的缺陷；六处 `ConfirmInline` 拆除；`src/components/SettingsModal.tsx` 数据页新增废纸篓
  - **闸门**：源码级 gate 由 6 道增至 7 道
  - **文档**：[[06-prd]] §6.1 重写（**该节自 v0.12 起自己登记了与实装不符**，见 §3）与 §6 数据模型加列；[[03-product-spec]] §13.3 六处删除语义 + 区域 9 废纸篓；[[05-design-spec]] `ConfirmInline` 用量收缩；[[10-ops-spec]] §3 废纸篓与备份的分工；[[04-user-flows]] 第 22 项重写据此解锁；[[07-features]] 与 [[11-test-spec]] 常规回流
  - **ADR**：兑现 [[025-unified-anchored-editing]] 与 [[022-cross-scene-phrase-move]] 两次写下的「另开 ADR 再议」欠账；不推翻二者任何结论

## 2. Status

`Accepted`（2026-09-03 omar 拍板：「删除从此一键完成、可撤销、东西进废纸篓，六个确认框拆掉」）

> **范围声明**：本 ADR 只裁**安全网**，即防止「我根本没想删它」。**显式不裁策展**，即「这东西过时了但我想留住它的历史」——那是 prd §6.1 写下的 `deprecated` 弃用标记，与本 ADR 并列而非同一件事，见 §5「显式不裁」。二者共用一张表但**不共用一个开关**。
>
> **落地进度（2026-09-03 当日实施 P0 + P1）**：**P0 全部落地**（commit `77637cd`）。migration `0013_soft_delete`（`user_version` 12→13）七表加 `deleted_at` 并重建 `idx_alignment_phrase_one_default_per_phase`；七处 `DELETE FROM` 经新增的 `repo-write/src/soft_delete.rs` 改 UPDATE；repo-core / repo-write / MCP 三处读路径补 `deleted_at IS NULL`；第七道源码级 gate `src/ipc/soft-delete-gate.test.ts` 落地（源码级 gate 6→**7**）；`restore_asset` / `list_trash` / `purge_trash` 三个 IPC（53→**56**，后两个是 P1 的后端底座，随 P0 同批落）；`toastStore` 撤销被顶掉的缺陷修复；六处 `ConfirmInline` 拆除改一键 + 撤销 toast（新增 `src/hooks/useUndoableDelete.ts` 收敛善后）；最近使用区滤掉解析不出目标的行。Rust 169→**182** / 前端 414→**444** 全绿。**P1 全部落地**（commit `6aca7eb`）：设置 · 数据页废纸篓区块——条目数 + 每条一行（类型 / 名称 / 删除时间）+ 单条恢复 + 「清空废纸篓」走 `ConfirmInline`（`ConfirmInline` 消费者由 P0 后的 0 恢复为 **1**）。列表是组件本地状态、每次打开重读，另有一个 `useRef` 同步闩防止连点把 `purge_trash` 打两次。P1 另修一个它自己暴露出来的洞，见修订 5。Rust 182→**183** / 前端 444→**457**。**P2** 即本次契约回流。
>
> **实施期口径修订 1 — 重复删除是 no-op，不是错误**：本 ADR 正文从未交代「删一条已经在废纸篓里的行」该返回什么。实施时定为**成功的空操作**（`SoftDeleteOutcome::AlreadyDeleted`），照 §3 约束 7 已验证的草稿软删先例；`Missing`（根本没这个 id）仍走各模块自己的 not-found 错误，两者不合并。理由是撤销 / 重做竞态与双击都会走到这条路径，而它们不该看到失败提示。
>
> **实施期口径修订 2 — 导出 data schema version 1.1 → 1.2**：本 ADR §5 子决策 6 只写了「`deleted_at` 一并写入导出文件」，**没料到那就是一次导出格式变更**。`DATA_SCHEMA_VERSION` 随之升 `1.2`；`check_schema_version` 按 **MAJOR** 比对，所以 1.1 的旧备份照常导入（无该字段的行反序列化为存活），1.2 文件被只认 1.1 的旧构建读到时字段被忽略，双向兼容。这条兑现的正是 §6「不可逆点」第 3 条自己的预警——`deleted_at` 进导出文件即进导入契约。
>
> **实施期口径修订 3 — 最近使用区的过滤范围窄于子决策 5 的措辞**：子决策 5 写「滤掉解析不出目标的行」。实装只滤**带 `target_id` 却解析不到**的行；composition 的使用记录**根本不带 `target_id`**，永远解析不出名字，但**不在过滤范围内**——滤掉它们是产品行为变更而非 O3 修复。这就是子决策 5 末尾自己记下的「既有缺陷、同批可修」，本次**未修**，仍是一笔独立欠账。
>
> **实施期口径修订 4 — 闸门的豁免是四类，不是子决策 2 写的两处**：子决策 2 原文「豁免只给两处，即导出与废纸篓查询本身」。源码里带 `soft-delete-gate: exempt` 注释的共 **12 处，归四类**——**导出** 7 处 / **废纸篓视图本身** 1 处 / **恢复读取** 2 处（恢复当然要读那条正在被恢复的行）/ **删除路径的存在性探针** 2 处（要看得见废纸篓行，才能把「已经删过了」这个空操作与「根本没这个 id」这个错误分开，即修订 1）。后两类是子决策 1 与修订 1 的必然推论，起草时没想到。
>
> ⚠️ **别把「十条豁免」读成闸门被稀释了**：这四类**全都是软删除自己的机件**，没有一条是**面向用户的列表读**——废纸篓视图要选的正是别人都藏起来的行，恢复与删除路径必须看得见废纸篓行才能工作，导出是全保真备份（子决策 6）。**没有任何一条豁免能把一条废纸篓里的行漏进用户看得见的列表**，而那正是这道闸门要防的唯一一件事。
>
> **同处一个诚实记账**：12 处 marker 只有 **10 条**能进 `EXPECTED_EXEMPTIONS` 清单——差的两处是软删与恢复各自那条**按表名动态拼**的 SQL，它们对扫描器**根本不可见**（gate 自列的盲区 3），写注释只是给读代码的人看的。因此子决策 2 那句「加豁免是需要过审的显式动作」在这两处**不成立**：真有人新写一条动态表名的读语句，这道闸门不会拦他。gate 的注释里已把这条盲区连同另外三条一并写明，本 ADR 在此备案，不粉饰。

> **实施期口径修订 5 — 恢复必须连同它挂靠的父级一起复活（P1 修，最要紧的一条）**：本 ADR 通篇假定「恢复 = 把那一行的 `deleted_at` 置回 NULL」，**从未设想过单条恢复本身会造出一个够不着的资产**。P1 做废纸篓视图时撞见了：`SceneNotEmpty` 只数存活的子内容（这是子决策 7 与「废纸篓行不该挡住父行」的必然推论），所以**先删一条话术、再删它那个已经空了的场景，是允许的**；此后单独恢复那条话术，它的 `deleted_at` 变成 NULL——于是**废纸篓不再列出它**，而它的场景仍然隐藏着——于是**仪表盘也渲染不出它**。行还在库里，用户既看不见也拿不回来。**这正是本 ADR 存在的理由所要消灭的那种损失，却由本 ADR 自己的恢复路径制造出来。**
>
> **修法是向上复活而不是拒绝恢复**：`restore_asset` 现在把被恢复行**挂靠的对象**一并复活——话术复活它的场景与子阶段，子阶段复活它的场景；另外五类挂在 `phases` 上或什么都不挂，而 `phases` 不是资产表、永远进不了废纸篓。选向上复活而不是「父级还在废纸篓里就拒绝恢复」，理由是**用户要的就是再看见这条资产，而不看见它所在的场景就看不见它**。子阶段那一步严格说不为可见性所必需（子决策 7 已让孤儿话术显示为未分组），仍然做，是为了让话术回到它原来那一组而不是悄悄换了分区。
>
> **连带效果**：`purge_trash` 里那条「跳过仍有存活子内容的废纸篓场景」的 FK 保护分支，**从可达降级为防御性**——现在制造不出那种状态了。
>
> 另两处非修订的实施说明：① 删除默认对齐话术仍被 `DefaultAlignmentPhraseProtected` 拒绝，`delete_scene` 仍被 `SceneNotEmpty` 拒绝（后者的子内容计数现在只数存活行）——本 ADR §5「显式不裁」第 2 条已声明不动这两条产品行为 ② toast 让位规则有一个刻意的例外：**error toast 仍然顶掉撤销 toast**。藏掉一次失败等于告诉用户「成功了」，那是正确性缺陷；而丢一个撤销按钮是可承受的，因为那一行已经稳稳躺在废纸篓里。

## 3. Context

### 触发事件

omar 2026-09-03 在第一性原理复盘中拍板：G4 走查剩余观察项是「门把手」，不值得逐项清；真正的洞是**删除不可逆**，原话是「删掉一条话术，它就永远消失了」。

### 这笔账挂了多久

| 出处 | 原文 |
|---|---|
| [[06-prd]] §6.1（**ratified**，`06-prd.md:429`） | 「Modifier 不允许 hard delete（哲学：历史痕迹是资产），所有『删除』操作等价于 `deprecated = true`」 |
| [[06-prd]] `:444` | 「上文『删除策略』的 soft-delete 表述与现实装不符……差异属既有欠账，是否回改 soft-delete 待 omar 裁定，本版仅如实登记」 |
| [[022-cross-scene-phrase-move]] 子决策 3（`:73`） | 「不做持久撤销栈（超出 D-5 范围，**Phrase soft-delete 独立立项时再议**）」 |
| [[025-unified-anchored-editing]] `:110` | 「**无软删除**：`delete_*` 是硬删除，无回收站表、无 `deleted_at`——任何『删除可撤销』方案都必然是后端契约变更，不存在纯前端解」 |
| [[025-unified-anchored-editing]] `:268` | 「真正可撤销的删除需要后端软删除……**若要做另开 ADR**」 |
| [[11-test-spec#4.3]] 观察 O3 | 硬删话术后 `usage_records` 成孤儿，最近使用区显示「（未知话术）」墓碑 |
| [[HANDOFF]] 第 13 / 21.2 项 | 同一笔账的两个编号，21.2 明写「先开 ADR 裁 prd §6.1 矛盾」 |

**一份 ratified 的文档在正文里承认自己说的不是真的，已经持续三个版本。** 这是本 ADR 必须存在的第二个理由。

### 技术约束（全部经代码核实）

1. **七张资产表**：`modifiers` / `macros` / `alignment_phrases` / `compositions` / `phrases` / `scenes` / `sub_stages`。主键全是 `TEXT PRIMARY KEY`，值为 Rust 侧 `Uuid::new_v4()`，**无 AUTOINCREMENT**，故 id 可安全长期保留。
2. **没有任何级联删除**。migrations 里每条 FK 都是裸的，无 `ON DELETE CASCADE` 也无 `SET NULL`，而 `PRAGMA foreign_keys` 在运行时是 ON（`repo-core/src/db.rs:123` / `:150` / `:172`）。因此父行删除会**报错而非级联**，`delete_scene` 靠前置计数返回 `SceneNotEmpty` 挡住（`scenes.rs:81-95`）。**一次删除最多影响一到两行，不是一棵子树。**
3. **`deprecated` 列已经存在，读路径已全部过滤，但无人写入**。五张表带 `INTEGER NOT NULL DEFAULT 0 CHECK (deprecated IN (0,1))`（`0001_initial.sql:15` / `:41` / `:79` / `:99` 与 `0004_compositions.sql:23`）；后端五处列表读过滤（`repo-core/src/repo.rs:50` / `:87` / `:156` / `:192` 与场景话术查询），前端再过滤一次（`src/hooks/useSearchResults.ts:88` / `:94` / `:105`）。**隐藏一条资产的管线已经铺好、通着、有测试保护，只差一个写入方。**
4. **排序是分区的**，列名统一 `order_index`：`phrases` 按 scene 加 sub_stage、`macros` 全局、`modifiers` 按 `group_kind`、`alignment_phrases` 按 phase、`compositions` 按 phase、`scenes` 全局、`sub_stages` 按 scene。任何「搬走再放回」的方案都必须重建这个位置。
5. **`usage_records.target_id` 没有 FK**（`0001_initial.sql:134`）。硬删资产后 usage 行成孤儿，`list_recent_usage`（`repo.rs:474-501`）LEFT JOIN 得到 NULL，`RecentList.tsx:77` 渲染成「（未知话术）」并禁用按钮。
6. **导出故意不过滤**（`repo-core/src/export.rs:18` 注释写明 every list here is UNFILTERED），以纳入 deprecated 与不可见行。
7. **已有的唯一一处软删是草稿**：`drafts.status` 取值 pending 或 discarded（`0003_drafts.sql:18`），配 `mark_discarded` 与 `mark_restored`（`draft_repo.rs:285` / `:298`），且**没有确认框、只有撤销 toast**（`DraftInbox.tsx:114-133`，注释明写这是刻意的）。本 ADR 是把这个已验证的形态推广到其余资产。
8. **C1 200ms**：本 ADR 的任何路径都不在唤起路径上，废纸篓查询只在设置页发生。

### 不决策的代价

每一次误点都是永久损失；ratified 的 prd 继续说谎；[[HANDOFF]] 第 22 项 user-flows 重写继续被卡住，因为它的删除流程写的是一个从未实装的三选项对话框。

## 4. Options Considered

### Option A：原地软删除 + 源码级闸门 ✅

- **描述**：七张资产表各加一列 `deleted_at TEXT NULL`。删除等于 `UPDATE ... SET deleted_at = ?`，行不动。所有列表读在既有的 `deprecated = 0` 之外再加 `deleted_at IS NULL`。新增第七道源码级 gate，读源码断言凡查询资产表必带这两个谓词。恢复等于把 `deleted_at` 置回 NULL。
- **优点**：
  - **id、创建时间、排序位与使用历史全部原封不动**，这正是 [[022-cross-scene-phrase-move]] `:57` 否决同形态方案时点名会丢的四样东西
  - 恢复是单行 UPDATE，**不需要重建排序位**，也不需要 payload 版本管理
  - 隐藏管线**已经建成**（见 §3 约束 3），读路径改造是在既有谓词旁边加一个，位置可穷举
  - 撤销 toast 与废纸篓视图是**同一份数据的两个窗口**，建一次得两层
  - 闸门把「将来有人漏写过滤」从**可能发生**变成**做不到**
- **缺点**：
  - 已删行留在主表里，表会单调增长，缓解见 §5 子决策 4 与 §6 反向后果
  - 唯一索引不认识隐藏行，必须逐个复核并重建，见 §5「动手前必须先修的两个坑」
  - 导出默认会带上废纸篓内容，见 §5 子决策 6
- **预估成本**：migration 一支；Rust 七处写路径、五处读路径、三个 IPC；前端六处删除按钮、一个设置页区块、toast 缺陷修复；新 gate 一道；测试与文档回流。分三期，见 §5。

### Option B：废纸篓表，把行搬走

- **描述**：删除时把整行序列化进 `trash_receipts(kind, payload_json, context_json, deleted_at)`，再从主表 DELETE；恢复时反序列化重新插入。
- **优点**：主表永远干净；导出天然不含废纸篓；读路径**零改动**，无「忘记过滤」风险
- **缺点**：
  - **必须重建 id、创建时间与分区排序位**，这正是本项目此前两次否决同形态方案的理由（[[022-cross-scene-phrase-move]] `:57` 与 [[025-unified-anchored-editing]] `:41`「撤回，维持现有确认框」）
  - `usage_records` 立刻成孤儿，最近使用区当场出墓碑，除非再补一套关联维护
  - payload 是 JSON 快照，schema 迁移后旧 payload 可能恢复不回来，需要额外的版本协议
  - 外部调研反复点名的成本：镜像结构与主表的 schema 需要长期保持同步
- **预估成本**：与 A 相当甚至更高，且多一套序列化协议

### Option C：不做软删除，只靠备份快照

- **描述**：删除仍是硬删除，恢复靠 `backup.rs` 的 `VACUUM INTO` 快照（`backup.rs:59`，五槽轮转 `backup.rs:17`）。
- **优点**：几乎零新代码
- **缺点**：恢复意味着**整库回退到某个过去时刻**，删错一条话术要以丢掉此后全部改动为代价；五槽轮转在连续操作下很快挤掉有用快照（[[HANDOFF]] 第 32 项已记同类风险）。**这是备份，不是撤销**，外部调研明确警告二者不可互相替代
- **预估成本**：极低，但不解决问题

### Option D：复用现成的 `deprecated` 列当废纸篓

- **描述**：不加新列，删除时置 `deprecated = 1`，读路径一个字都不用改。
- **优点**：**成本最低**，五张表的过滤已经写好，当天可落地
- **缺点**：
  - 把**策展**与**安全**塞进同一个开关。`deprecated` 在 prd 里有明确且不同的语义，即「历史痕迹是资产」的主动弃用（`06-prd.md:37`）；一旦复用，将来做弃用功能时无法区分「用户主动弃用」与「用户误删待恢复」
  - `scenes` 与 `sub_stages` 本来就没有这一列，仍需 migration，省不掉
- **预估成本**：最低，但制造一个必然要拆的耦合

## 5. Decision

> **一句话拍板**：选择 **Option A**，理由是**隐藏管线在这个项目里已经建成且闲置**，原地不动就能保住 id、创建时间、排序位与使用历史这四样此前两次否决同类方案时点名会丢的东西，剩下的唯一风险「将来漏写过滤」用一道源码级闸门从结构上消掉。

**为什么不选其他**：

- 不选 B 因为：它要重建 id、创建时间与分区排序位，正是 ADR-022 与 ADR-025 两次否决的那条路；而它换来的「读路径零改动」优势，在本项目里因为过滤早已写好而基本不存在
- 不选 C 因为：整库回退不是撤销，代价是丢掉此后的一切
- 不选 D 因为：它把策展和安全塞进同一个开关，省下的那点成本会在做弃用功能时连本带利还回来

### 子决策

**子决策 1 — 新增 `deleted_at TEXT NULL`，不复用 `deprecated`。** 两列并列：`deprecated` 归策展，本 ADR 不动它，仍无人写入；`deleted_at` 归安全。读路径谓词从 `deprecated = 0` 变为 `deprecated = 0 AND deleted_at IS NULL`。用时间戳而非布尔，因为废纸篓列表要按删除时间排序，且「何时删的」是用户判断要不要恢复的主要依据。

**子决策 2 — 新增第七道源码级闸门。** 本项目已有六道 gate，分别管 token 纪律、B2 物理分离、IPC 三方契约、文档引用契约、密度层单调性与双光主题对等；它们读源码，违规即让 `pnpm test` 变红。第七道断言：凡查询资产表的语句必须同时带 `deprecated = 0` 与 `deleted_at IS NULL`，**除非带显式豁免注释**。豁免只给两处，即导出（见子决策 6）与废纸篓查询本身。**这条是选 A 的前提**，没有闸门，A 就退化成外部调研反复警告的那个坑。

**子决策 3 — 六处「永久删除？」确认框拆除，改一键删除加撤销 toast；只在「清空废纸篓」保留一个确认。** 依据是 [[025-unified-anchored-editing]] `:125` 已经 ratified 的规矩「**撤销优于确认，但仅限真正可逆的动作**」。此前删除不可逆，所以确认框是对的；本 ADR 让它可逆，所以确认框该退场。确认框是最容易被点穿的安全措施，天天出现就会变成肌肉记忆；而撤销要求的是发现错了再动手，不依赖用户在动手前保持警觉。拆除位置：`AlignmentPhrases.tsx:323`、`ScenePropertiesEditor.tsx:303`、`MacroGrid.tsx:355`、`ModifierGrid.tsx:165`、`scene/ViewPhraseCard.tsx:105`、`scene/ViewColumn.tsx:139`。这与草稿丢弃早已采用的形态一致。

**子决策 4 — 废纸篓不自动过期，只由用户手动清空。** 不设保留天数，不设定时清理任务。三条理由：一是全库皆文本，prd `:948` 的规模天花板是数百行量级，占用可忽略；二是「你的数据过期了」是比列表变长更糟的惊吓；三是这恰好兑现 prd `:37` 自己写下的「历史痕迹是资产」。**代价**是表会单调增长，需要在废纸篓视图显示条目数，并在 ops-spec 记明这不是备份的替代品。

**子决策 5 — `usage_records` 一行都不动。** 软删资产时不碰它的使用记录；资产恢复后历史自动重新连上，因为 id 从未变过。最近使用区改为**滤掉解析不出目标的行**，而不是渲染「（未知话术）」墓碑，这一步销掉 G4 观察 O3。孤儿 usage 行只在用户清空废纸篓时才真正产生，由清空动作一并清理。**顺带记一个既有缺陷**：`list_recent_usage` 没有 composition 的 LEFT JOIN 分支，composition 的使用记录即使资产健在也永远无名，与本 ADR 无关但同批可修。

**子决策 6 — 导出包含废纸篓内容，保持全保真。** `export.rs:18` 的「故意不过滤」不改，废纸篓里的行照常导出，`deleted_at` 一并写入导出文件。理由是导出在本项目里的定位是本地全量备份，守 [[02-constitution#A2]]，文件只写用户选定的本地路径；而一份丢掉废纸篓的备份会让「导出再导入」变成一次静默的永久删除。导入侧的整库替换照旧会清掉当前废纸篓（`import.rs:34-44` 九表 WIPE_ORDER），这有 `pre-import` 快照兜底（`commands.rs:850-865`）。

**子决策 7 — 删除子阶段不再解绑其下话术。** 今天 `delete_sub_stage` 在事务内把 `phrases.sub_stage_id` 置空（`sub_stages.rs:60-63`）。改为**什么都不动**：子阶段行标记删除，话术仍指向它，场景列视图把「所属子阶段已删除」的话术当作未分组显示。这样恢复子阶段是纯单行 UPDATE，话术自动归位，无需任何记账。解绑动作下移到清空废纸篓时执行，因为那时 FK 会真的挡路。

### 动手前必须先修的两个坑

1. **唯一索引不认识隐藏行。** `idx_alignment_phrase_one_default_per_phase` 是 `ON alignment_phrases (phase_id) WHERE is_default = 1`（`0001_initial.sql:45-47`），既不含 deprecated 也不会含 deleted_at。软删一条默认对齐话术后，它仍占着那个相位的默认位，用户将**永远设不了新的默认**。migration `0013` 必须把该索引重建为 `WHERE is_default = 1 AND deleted_at IS NULL`。全库唯一索引共三处，另两处是 `sop_steps` 的 `UNIQUE (sop_id, order_index)` 与 `idx_drafts_hash_pending`，不涉及本 ADR 的表，但需在实施时逐一复核。
2. **撤销 toast 会被后一条 toast 顶掉。** `toastStore.ts` 的 arm 助手在一次 `set` 里覆写 message、action 与 seq（`toastStore.ts:37-41` / `:79`），因此任何后续 toast 都会**在撤销窗口未过期时静默销毁它**。撤销一旦成为主要安全网，这个缺陷必须先修：带 action 的 toast 在其存活期内不可被无 action 的 toast 覆盖。

### 显式不裁

- **`deprecated` 弃用标记（策展）**：仍无人写入。要不要做、以及 [[04-user-flows]] §4 那个从未实装的三选项对话框要不要兑现，均另案。本 ADR 只保证不挡路
- **非空 Scene 是否可删**：仍按 `SceneNotEmpty` 阻止。软删让「连同子内容一起进废纸篓」在技术上变得可行，但那是产品行为变更，不在本 ADR
- **跨设备同步或云端回收站**：违反 [[02-constitution#A2]]，不考虑
- **`usage_records` 的季度归档**（`06-prd.md:771` 写过、从未实装）：与本 ADR 无关，不顺手做

### 实施分期

| 期 | 内容 | 完成即可宣称 |
|---|---|---|
| **P0** | migration `0013` 七表加列 + 重建默认话术唯一索引；七处写路径改 UPDATE；五处读路径补谓词；第七道 gate；修 toast 覆盖缺陷；六处确认框换撤销 toast；最近使用区滤墓碑 | **删除有后悔药了** |
| **P1** | 设置 · 数据页新增废纸篓：列表、单条恢复、清空（带确认，并清理孤儿 usage） | 隔几天后悔也救得回来 |
| **P2** | 契约回流：本 ADR 补落地明细、prd §6.1 重写、product-spec §13.3 与区域 9、design-spec `ConfirmInline` 用量、ops-spec §3 分工、features 与 test-spec；[[HANDOFF]] 第 22 项 user-flows 重写解锁 | 文档与实装一致 |

**migration 号冲突提醒**：[[HANDOFF]] 第 21.1 项也预留了 `user_version` 12→13，用于 usage 唤起时间戳。两者谁先落地谁取 13，后者顺延，不合并。

## 6. Consequences

### 正向后果

- **误删不再是永久损失**，这是本 ADR 的全部目的
- **六个弹窗减为一个**，删除动作从两步变一步，且更安全
- **一份 ratified 的 prd 停止说谎**，§6.1 挂了三个版本的自我矛盾就此了结
- **销掉 [[HANDOFF]] 第 13 与 21.2 项以及 G4 观察 O3**，解锁第 22 项
- **兑现 ADR-022 与 ADR-025 两次写下的欠账**，两条「另开 ADR 再议」在此收口
- **第七道闸门是可复用的资产**，将来任何新增的资产读路径都自动受保护

### 反向后果

- **主表单调增长**。已删行不再消失，且按子决策 4 不自动清理。缓解是废纸篓视图显示条目数，但**长期增长是真实成本**，不粉饰
- **每一条新查询都多一个谓词要写**。闸门保证不会漏，但它同时意味着以后写查询多一道必须过的关
- **导出文件会变大**，且会包含用户以为已经删掉的内容。这是子决策 6 的自觉取舍，必须在 product-spec 里对用户写明
- **失去确认框这层心理缓冲**。有人会因为知道能撤销而更容易点删除。这是刻意的，但它确实把安全感从动手前挪到了动手后
- **清空废纸篓成为新的不可逆动作**，风险从多个删除按钮集中到一个地方。集中比分散好管，但它一次能毁掉的东西更多

### 未来反悔成本

- **代码改造规模**：若要退回硬删除，七处写路径改回 DELETE、五处读路径去谓词、删除第七道 gate、废纸篓 UI 下线，约十余个文件。**难点不在代码而在数据**，退回时必须先决定库里已有的软删行是恢复还是销毁
- **数据迁移**：`deleted_at` 列可保留不用，无需 down migration，本项目 migration 本就是 forward-only（`db.rs:197-211`）
- **学习成本**：无，不引入任何新依赖，不动 [[09-tech-stack]]
- **不可逆点**：
  1. 一旦六处确认框拆除并发布，用户的删除肌肉记忆会随之改变，再加回确认框是二次伤害
  2. 一旦用户开始依赖废纸篓，把保留策略改成「N 天自动清除」等于单方面缩短承诺
  3. `deleted_at` 一旦写进导出文件就进入导入契约，改字段名要动 schema 版本

---

## 相关链接

- **触发本决策的文档**：[[06-prd#6.1]] 删除策略与其自登记的 drift、[[11-test-spec#4.3]] 观察 O3、[[HANDOFF]] 第 13 与 21.2 项
- **被本决策影响的文档**：[[06-prd]] §6.1 与 §6 数据模型、[[03-product-spec]] §13.3 与区域 9、[[05-design-spec]] §10.2.2 `ConfirmInline`、[[10-ops-spec]] §3、[[04-user-flows]] §4、[[07-features]]、[[11-test-spec]]
- **相关 ADR**：[[022-cross-scene-phrase-move]] 子决策 3 埋下的「独立立项时再议」、[[025-unified-anchored-editing]] `:110` 与 `:268` 判定必须另开 ADR 且 `:125` 提供「撤销优于确认」规矩、[[026-fixed-spatial-layout]] 六区固定故废纸篓落在设置页、[[003-choose-data-persistence]] SQLite 单库
