---
name: doc-change
description: prompt-hub 改设计文档、记录类文档或开 ADR 之前加载。判定一次改动走「方法论 §7 八步」「减法快车道」还是「日志不签字·反查归档」，给出主笔分工、ADR 触发条件与 anchor 写法。改 docs/design/*、docs/adr/*、CHANGELOG、HANDOFF、CLAUDE.md 时都适用。
---

# 文档变更流程（prompt-hub）

> 本文件是 `CLAUDE.md` §5 的**完整版**。CLAUDE.md §5 只留每条规则的一句话与锚点（全仓 `[[CLAUDE#§5.x]]` 引用仍指向那里）；判定表、边界与「为什么」在这里。两处冲突时以本文件为准，并顺手把 CLAUDE.md 那一句改对。

## 先判类型（30 秒）

1. 改的是 01-spec / 02-constitution？→ **人主笔**，AI 不得起草（§5.2）。停手，交给使用者。
2. 是纯删除 UI，且落在快车道四类内、没越界？→ **§5.1.1 快车道**：只在 `docs/design/CHANGELOG.md` 记一行。
3. 改的是记录类内容（test-spec §2 / §4.x、features §7、CHANGELOG、HANDOFF）？→ **§5.1.2 反查归档**：起只读子代理逐句反查，不进人审队列。
4. 其他一切改「应该长什么样」的契约条款 → **§5.1 八步**，图纸送人审。
5. 有「二选一 / 多选一」的不可逆决策、宪法变更、技术栈 major bump → 先开 **ADR**（§5.3）。

## 规则原文（自 CLAUDE.md §5 迁入，2026-11-23，#38）

### 5.1 变更必须走方法论 §7 八步
任何 spec / prd / product-spec / design-spec 改动走 [[~/Vault/知识库/方案模板/产品文档体系方法论#§7]] 流程：锁定 diff → 影响半径 → 上游一致性 → bump → 涟漪更新 → features 回写 → ADR → AI 层同步。

#### 5.1.1 减法快车道（2026-08-18 omar 拍板）

**纯删除类 UI 改动不走八步**，只在 `docs/design/CHANGELOG.md` 记一行即可提交。

适用范围（**四类，封闭清单**）：

| 类别 | 例 |
|---|---|
| 删解释性文案 | 层标记 pill、区域副标题、无决策价值的计数 |
| 删装饰 | 重复图标、冗余色块、纯修饰性描边 |
| 删未实现占位 | 尚无实装的区域 stub |
| 删动效 | 触发 layout 的 transition、无信息量的位移动画 |

**边界（越界即回落八步）**：

- ❌ 删的东西**承载语义或状态**（区分层级 / 表达选中 / 传递计数含义）→ 不是减法，是契约变更
- ❌ 删 `tokens.css` 条目 → 属 [[05-design-spec]] §3c token 契约，走八步
- ❌ 删区域、删功能、删数据字段 → 走 ADR
- ❌ 一次删三处以上 → 已构成设计 pass，走八步

**为什么开这条**：八步对"新增"与"删除"施加同等仪式成本，使得修一个 UI 缺陷比新增一个 UI 区域更贵，理性选择就是继续新增——这正是前端"什么都有道理但主角不明"的成本结构成因（2026-08-17 前端评价复盘）。快车道只降**减法**的成本，不降加法的。

**留痕要求**：CHANGELOG 那一行必须写明删了什么 + 依据哪一类，否则半年后无法与"手滑删掉"区分。

#### 5.1.2 日志不签字（2026-09-03 omar 拍板）

**人审只签「图纸类」改动**——[[01-spec]] / [[02-constitution]] / [[03-product-spec]] / [[05-design-spec]] / [[06-prd]] 里回答「应该长什么样」的契约条款。

**「记录类」内容不进人审队列**——[[11-test-spec]] §2 计数与 §4.x 走查记录、[[07-features]] §7 留证、`docs/design/CHANGELOG.md`、[[HANDOFF]]。这类内容由 AI 逐句反查代码后**直接归档**（`status` 可直接写 `ratified`），omar 想抽查随时翻。

**一份文档两类并存时按章节分**：test-spec §1 / §3 / §5 是图纸（改测试分层、改 gate 契约、改性能预算走人审），§2 / §4.x 是日志。

**反查怎么做**：起**只读**子代理，对增量逐句出三列——一致 / 不一致（附 `file:line`）/ 无法核（真机观测、截图、退出码这类代码里没有对应物的）。不一致的**先改再归档**；无法核的条目保留原文并在归档说明里标明条数。

**送审图纸时只给「一句话的决定 + 推荐选项」**，不把 diff 落点逐条列成裁点——裁点数量应该等于决策数量，不等于改动数量。

**为什么开这条**：八步对「改图纸」和「记日志」收一样的签字费，于是每段工作都攒出一批待人审，人审成了瓶颈而不是防线。而记录类内容的真实风险根本不是「omar 没看」，是**AI 凭印象写错**——G4 的 D1 / D2 / D3 三个根因走查当天全写错，纠错靠的是回头读代码不是人签；本规则首跑就在 [[11-test-spec]] 的增量里抓出 8 处不一致。**签字签不出正确性，反查才行。**比喻：房主签图纸，不签施工日志。

### 5.2 文档主笔人分工
- 🧑 人主笔：`docs/design/01-spec.md` / `docs/design/02-constitution.md`
- 🤝 共创：`CLAUDE.md` / `docs/adr/*` / `docs/design/04-user-flows.md` / `docs/design/03-product-spec.md` / `docs/design/05-design-spec.md` / `docs/plans/prompt-hub-mvp.md`
- 🤖 AI 主笔（人审）：`docs/design/06-prd.md` / `docs/design/11-test-spec.md` / `docs/design/10-ops-spec.md` / `docs/design/07-features.md` / `docs/design/08-sitemap.md` / `docs/design/09-tech-stack.md`

AI 不得擅自起草人主笔文档（spec / constitution），可起草共创 / AI 主笔文档但必须等人审。

### 5.3 决策走 ADR
- 任何"二选一/多选一"的不可逆决策 → 开 ADR（模板：`docs/adr/000-template.md`）
- constitution 变更 → 必须先开 ADR（[[02-constitution#E1]]）
- 技术栈 bump major version → 必须开 ADR（[[09-tech-stack#§5]]）

### 5.4 Anchor 命名约定

项目采用**复合 anchor** 指代表格行 / 子任务项 / 列表项。标准 Markdown 解析器（GitHub / Obsidian 部分场景）不一定能跳转，但人/AI 阅读时可定位：

- `[[prompt-hub-mvp#§0-T1]]` — prompt-hub-mvp.md §0 章节下的 T1 子任务（实际标题 `### T1 ...`，单独 anchor 也能解析为 `[[prompt-hub-mvp#T1]]`）
- `[[09-tech-stack#§3-D1]]` — 09-tech-stack.md §3 决策表的 D1 行（**不可解析**：D1 是表格行不是标题，纯人/AI 视觉定位）
- `[[CLAUDE#§6]] 第 N 项` — 列表项用"§N + 文字补语"，不写 `#§6-#N` 复合形式

**新增引用时**：优先用真实标题 anchor；表格行 / 列表项的复合形式仅在"指向粒度小于子标题"时使用，且默认接受其不可机器跳转。

---


## 收尾自检

- `pnpm test` 里的 doc-governance 闸门（`scripts/doc-governance/doc-refs-gate.test.ts`）绿：引用不悬空、MANIFEST 覆盖、frontmatter、`CLAUDE.md` 版本表与目标文档一致。
- 动了 01–11 任一份的 `version`，同步改 `CLAUDE.md` §7 版本表那一行（闸门会抓）。
- `CLAUDE.md` 只改协议层内容；本轮做了什么写 CHANGELOG，下一步做什么写 HANDOFF（`context-budget` 闸门会挡住往 CLAUDE.md 里塞日期）。
