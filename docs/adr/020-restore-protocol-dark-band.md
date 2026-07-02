---
type: adr
project: prompt-hub
id: ADR-020
status: Accepted
date: 2026-07-01
description: 恢复协议层暗色 band——调和 ADR-018「吸收 Promptscape 暗 band」与 ADR-019「全面中性化」的实现冲突。新增 --band-* 层级固定色 token（双主题恒为深底浅字，light 取设计稿 oklch(0.165)/oklch(0.985) 口径翻译为项目 hex 体系），band 作用域整体重映射中性 token 使内部子组件可读；同批修缮层级编码（ModifierGrid 补「协议层 · 参考」层标记、RecentList 协议徽标撤 --accent 实底改中性描边）。band token 属「位置维度的层级固定色」，不属 ADR-019 所废除的颜色本体论（accent 语义色）本体
related:
  - 05-design-spec
  - 018-absorb-promptscape-design
  - 019-supersede-flat-visual-anchor
  - 02-constitution
  - CLAUDE
---

# ADR-020: 恢复协议层暗色 band（层级固定色，非语义色）

## 1. 标题与日期

- **标题**：恢复 Promptscape 设计稿的协议层暗色 band（双主题深底浅字），并澄清 band 颜色属「层级固定色」、与 ADR-019 废除的颜色本体论不冲突
- **日期**：2026-07-01
- **决策者**：omar（用户拍板）／AI 起草
- **影响范围**：
  - `src/styles/tokens.css` —— 新增 `--band-*` token 族（bg / fg 三档 + ghost / surface 三档 / border 三档 / band-safe accent 别名）
  - `src/components/ProtocolBand.module.css` —— band 改 `--band-bg` 深底 + band 作用域重映射 `--surface-*` / `--border-*` / `--fg-*` / `--aux` / `--accent`，内部 PhaseBar / AlignmentPhrases / Chip 等子组件无须逐个改色
  - `src/components/ModifierGrid.{tsx,module.css}` —— 区头补「协议层 · 参考」小型层标记（aside 侧此前无层标记，而 Modifier 属协议层，[[05-design-spec#13.1]]）
  - `src/components/RecentList.{tsx,module.css}` —— 「对齐话术」徽标撤 `--accent` 实底，改与任务徽标同形的中性描边（§13.1「accent 不承载语义」合规修缮）
  - [[05-design-spec]] §10.8.2（ProtocolBand 视觉契约「`--surface-1` 底」过时）+ §4（配色）需 bump 涟漪
  - `CLAUDE.md` §7「协议层暗色 band」表述——保留并挂本 ADR 锚点

## 2. Status

`Accepted`（2026-07-01，omar 拍板恢复暗 band）

## 3. Context

### 触发事件

P3 走查发现协议层视觉与 Promptscape 设计稿持续不符，根因是两个已 Accepted 的 ADR 在实现层打架：

- [[018-absorb-promptscape-design]]（2026-06-25 Accepted）明确吸收设计稿的「**协议层暗色 band**」——设计稿 `.dc.html:55` 为 `background: oklch(0.165 0 0)` 深底 + `color: oklch(0.985 0 0)` 浅字，**双主题都是暗 band**
- [[019-supersede-flat-visual-anchor]]（2026-06-26 Accepted，Option A）随后「放弃颜色本体论、全面转中性」，实施时把 band 顺手中性化为 `--surface-1` 底 + hairline 框，light 模式下 band 退化为一张白卡，CSS 注释以「no light oklch band」为据——**过度执行**：ADR-019 废除的是「颜色绑资产类型」的 accent 语义色（`--protocol` 紫 / `--task` 绿），从未要求废除 band 的明度层级
- 用户已有既定偏好「UI 与设计稿冲突时默认改成设计稿」（memory: feedback_ui_follow_design），且 ADR-019 Option A 的已知代价正是「协议/任务一眼区分降到只剩 ProtocolBand 位置维度」——暗 band 恰是对这唯一维度的补强

### 业务约束

- [[02-constitution#B2]] 只管结构分离（AlignmentPhrase 不入 SOP / Macro 不展示 AlignmentPhrase），不约束颜色（ADR-019 已校正）——本决策全程不触 B2
- [[05-design-spec#13.1]]「accent 不承载语义」仍有效：恢复暗 band 不得回退为「紫=协议」的语义色编码

### 技术约束

- CLAUDE §4.1 token 铁律：band 色必须进 tokens.css，组件 CSS 禁裸 hex
- band 内子组件（PhaseBar / AlignmentPhrases 展示态与编辑态 / Chip / Kbd / Button / Editor primitives）全部引用全局中性 token（`--surface-*` / `--fg-*` / `--border-*` / `--accent`），light 模式下这些 token 解析为浅色系——深底上直接不可读，必须为 band 作用域做整体 token 重映射
- 中性 accent swatch 解析为 `--fg-1`（light 下为深墨色），在暗 band 上会隐形——需 band-safe accent 别名（`--band-accent`），彩色 swatch（blue/green/violet/amber）在暗底上可读、保持用户所选色

### 不决策的代价

- 实现与设计稿的「协议层压舱感」持续不符，每次视觉走查重复报同一差异
- 018 与 019 的边界不澄清，后续吸收设计稿时「中性化」会继续吞掉非语义的明度层级设计

## 4. Options Considered

### Option A: 恢复暗 band——band 色定义为「层级固定色」token（√ 已拍板）

- **描述**：新增 `--band-bg` / `--band-fg` 等 `--band-*` token（双主题恒为深底浅字：light 取设计稿 oklch(0.165)/oklch(0.985) 口径翻译为项目 hex 体系 `#18181b`/`#ececee`；dark 下同值读作 ~surface-2 深度的抬起面，与 `#0e0e10` canvas 保持可辨明度差）。ProtocolBand 在 band 作用域重映射整套中性 token，子组件零改动即可读。本体论澄清：band 色染的是**容器位置**，不绑任何资产类型，属 ADR-019 未废除的「层级固定色」。
- **优点**：
  - 兑现 ADR-018 吸收清单 + 用户「设计稿为准」偏好，协议/任务的位置维度区分被明度差补强（ADR-019 降一维的已知代价得到部分回收）
  - token 重映射一处生效，band 内全部子组件（含编辑态）自动可读，无逐组件散改
  - 与 ADR-019 无冲突：`--protocol`/`--task` 语义色继续退役，新 token 不按资产类型取色
- **缺点**：
  - light 模式出现一块深色岛，与全浅色 UI 的「中性气质统一」有张力（设计稿本身如此，属有意设计）
  - `--band-*` 是一套平行 token 族，维护面 +11 个 token + 4 条 accent 覆盖
- **预估成本**：低——tokens.css + ProtocolBand.module.css 两处，子组件不动

### Option B: 维持中性化现状（surface-1 白/灰 band）（✗ 落选）

- **描述**：保留 ADR-019 实施时的 `--surface-1` 底 + hairline 框，band 与 canvas 仅一层 surface 差。
- **优点**：零改动；light 模式无深色岛，气质最统一
- **缺点**：
  - 与 ADR-018 已 Accepted 的吸收清单直接矛盾（吸收项就是「暗色 band」），且违背用户「设计稿为准」既定偏好
  - 协议/任务区分只剩「band 在上方」一个弱信号，ADR-019 降维代价不做任何补偿
- **预估成本**：零（但决策债保留）

## 5. Decision

> **一句话拍板**：选择 Option A（omar 2026-07-01 拍板）——恢复设计稿口径的暗色 band，band 色以 `--band-*`「层级固定色」token 落地；它编码的是**位置/明度层级**而非资产类型语义，不属 [[019-supersede-flat-visual-anchor]] 所废除的颜色本体论本体，018/019 冲突就此调和。

**为什么不选 B**：B 把 ADR-019 的「中性化」过度延伸到了非语义的明度层级上，既违反 ADR-018 的已 Accepted 吸收范围，也与用户「UI 冲突时以设计稿为准」的既定偏好相悖；且它让 ADR-019 的降维代价（一眼区分变弱）无任何补偿。

**同批层级编码修缮**（依据 [[05-design-spec#13.1]]，随本 ADR 一并落地）：
- ModifierGrid 区头补「协议层 · 参考」小型层标记（与协议/任务 pill 同规格）——aside 侧此前无层标记，而 Modifier 属协议层；纯视觉标签，不改变 B2 物理分区
- RecentList「对齐话术」徽标从 `--accent` 实底改为与任务徽标同形的中性描边，靠文字区分——修缮「accent 承载语义」违例

## 6. Consequences

### 正向后果

- 协议层获得设计稿的「压舱」视觉权重，位置维度区分被明度差冗余编码补强
- `--band-*` 进 tokens.css 单一真源；band 作用域 token 重映射模式（容器改色、子树自适应）沉淀为可复用手法
- 018 与 019 的适用边界文档化：「中性化」只约束语义色，不吞明度层级

### 反向后果

- light 模式引入深色岛，「全浅中性」气质被打破（有意为之，随设计稿）
- token 面扩大：11 个 `--band-*` + `--band-accent` 双别名 + 4 条 swatch 覆盖需随中性 ramp 演化同步维护
- band 内组件若未来新增引用了未重映射的 token（如 `--skeleton` / `--shadow-*`），须记得补 band 作用域映射，否则 light 模式下可能出现可读性回归

### 未来反悔成本

- **代码改造规模**：撤回 ≈ 还原 ProtocolBand.module.css + 删 tokens.css band 节 + 撤两处修缮（约 4 文件），并再 bump design-spec——量小但属第三次反转（018 吸收 → 019 中性化 → 020 恢复 → ?），决策信誉成本大于代码成本
- **数据迁移**：无（纯视觉）
- **学习成本**：无新技术；心智锚补一条「层级固定色 ≠ 语义色」
- **不可逆点**：用户形成「协议层 = 顶部暗 band」的视觉习惯后，再次抹平 = 又一次「换了产品」

---

## 反模式（写完自检）

- ✅ Options 2 个（恢复暗 band / 维持中性化），Decision 一句话
- ✅ Consequences 含未来反悔成本与不可逆点，反向后果不回避「深色岛打破气质统一」
- ✅ 不修改 018/019 原文：二者均仍 Accepted，本 ADR 只澄清边界（019 废语义色、018 的暗 band 属明度层级），非 supersede
- ✅ B2 复检：band 色与两处层标记均为视觉编码，AlignmentPhrase/SOP/Macro 的结构分离零触碰

## 相关链接

- 触发本决策的文档：[[018-absorb-promptscape-design]]（吸收清单含暗 band）/ [[019-supersede-flat-visual-anchor]]（中性化实施时过度执行）/ `docs/design-handoff/project/Promptscape 全景仪表盘.dc.html:55`（band 设计口径）
- 被本决策影响的文档：[[05-design-spec]] §10.8.2 + §4（需 bump 涟漪）/ `CLAUDE.md` §7（「协议层暗色 band」表述保留并挂本 ADR）
- 相关 ADR：[[018-absorb-promptscape-design]] / [[019-supersede-flat-visual-anchor]]
