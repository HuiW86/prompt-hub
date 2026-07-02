---
type: adr
project: prompt-hub
id: ADR-012
status: Superseded # by ADR-019（2026-06-26 omar 拍板推翻 flat 锚点）；原 Accepted 2026-05-24
date: 2026-05-24
description: 锁定 Linear 整体气质为 prompt-hub 视觉质感锚点（Option A）；从此 design-spec 不再 token-only，新增「质感锚点 / typography 组合 / 组件 pattern / 状态规范 / icon 系统 / 视觉权重」六章；不触动 [[02-constitution#B2]] 色块即本体与反设计清单底线
related:
  - 01-spec
  - 02-constitution
  - 03-product-spec
  - 05-design-spec
  - CLAUDE
  - prompt-hub-mvp
  - 009-choose-styling
---

# ADR-012: 锁定视觉质感锚点与 design-spec 升级路径

## 1. 标题与日期

- **标题**：选择哪个产品作为 prompt-hub 视觉质感锚点，并据此把 [[05-design-spec]] 从 token-only 升级到「token + 组合规则 + 质感锚点」
- **日期**：2026-05-24
- **决策者**：omar
- **影响范围**：[[05-design-spec]] bump major（新增 6 章）/ [[03-product-spec#§13]] 区域视觉契约需补 / [[docs/mockups/prompt-hub.html]] 重做 / 8 个已实现组件 CSS 改写 / [[CLAUDE#§4.1]] CSS token 铁律不变 / [[009-choose-styling]] CSS Modules 决策不变

## 2. Status

`Superseded by ADR-019`（2026-06-26）——原 `Accepted`（2026-05-24，omar 拍板 Linear-class 锚定 Option A）。[[019-supersede-flat-visual-anchor]] 推翻本 ADR 的「反 polish / Bloomberg-flat」视觉锚点（启用本 ADR §4 当年明示排除的 Option E），引入 elevation 并放弃颜色本体论。

> 校正备注：本 ADR §4 Option E / §6 相关链接曾把「推翻反 polish」门槛挂到 [[02-constitution]] 与 [[01-spec]]；ADR-019 核对原文后澄清——颜色本体论与反阴影底线实际住 [[05-design-spec#§2.4.1]]/[[05-design-spec#§8.2]]（🤝 AI 可起草层），constitution B2 只管结构分离不管颜色，推翻无须人主笔改宪法。

## 3. Context

### 触发事件
第一阶段 MVP 全链路验证后（commit `0fbab2d`），实测主形态截图显示典型「工程师审美 / wireframe 残留」问题——PhaseBar 双框感、SOP 占位 dashed border + 灰字、4 面板等权重无主从、emoji 与 SVG 混排、卡片内 typography 单一无梯度、空 phase 无 disabled state。问题不是实施 bug，而是 [[05-design-spec]] **token-only** 没给「组合规则 / 质感锚点 / 组件 pattern / 状态规范」，AI 实施时只能按字面拼 token，组合出工程师审美。

### 业务约束
- [[02-constitution#B2]] 色块即本体——协议紫 / 任务绿 / 辅助米三色 family 不能丢，仍是主要区分手段
- [[02-constitution]] + [[05-design-spec#§5]] 反设计清单——反阴影 / 反渐变 / 反玻璃感 / 反 skeuomorphism 仍是底线（否则需先开 ADR 改宪法）
- [[01-spec]] 九条哲学之「认知缓冲 > polish」「信息密度 > 视觉舒服」仍是底线
- 简言之：**升一档质感，但不背叛哲学**（推翻哲学是 ADR-013+，不在本 ADR 范围）

### 技术约束
- [[009-choose-styling]] CSS Modules + CSS variables 已锁，本 ADR 不改样式工具
- token 命名约定 `--fs-* / --space-* / --color-* / --duration-*` 已落 8 组件，新增组合规则需向前兼容
- icon 系统未定，emoji 混排是缺规范结果，本 ADR 顺带定 icon family

### 参考产品候选
- **Linear** —— 高密度 + 扁平 + 高频键盘工具，气质与 prompt-hub 同源
- **Raycast** —— 命令面板气质，快捷键提示 / 列表分组 / accent-color 系统成熟
- **Things 3** —— 工具型仪表盘代表，信息分层 / 大留白 / 字号梯度
- **Notion / Tana** —— 块化 + 极简，但偏文档场景
- （**故意排除**）Obsidian / VS Code —— 工程师审美的代表，正是当前 UI 的样子，参考它们等于不参考

### 不决策的代价
- 第二阶段 Composition 工作台 / 沉淀视图开始前若不锁，UI 继续按工程师审美演化，越走越偏
- 用户上线后形成的视觉印象一旦定型，再换会感觉「换了产品」，反悔成本陡升
- design-spec 维持 token-only，未来 AI / 新成员实施时仍会重复犯本次错

## 4. Options Considered

### Option A: Linear-class 整体气质锚定（推荐）

- **描述**：以 Linear 为唯一视觉锚点，借其「克制 typography + 呼吸间距 + section header 设计感 + 微交互精度」整体气质；不借阴影 / 渐变 / 玻璃感
- **优点**：
  - 气质与 prompt-hub 同源（密度高 + 扁平 + 键盘驱动 + 工具型）
  - Linear 设计系统公开度高，参考素材丰富
  - 单锚点保美学一致性，不会拼接味重
  - 完全兼容 [[02-constitution#B2]] 色块即本体 + 反设计清单
- **缺点**：
  - 「Linear-like」会成为外界第一印象（可能被说 me-too）
  - Linear 没有相位带 / Macro 卡这类组件，组件层面仍需自创
- **预估成本**：design-spec 补 6 章 ~5 天 / 8 组件 CSS 升级 ~3 天 / mockup 重做 ~2 天 / 合计 ~10 天

### Option B: Raycast-class 命令面板气质锚定

- **描述**：以 Raycast 为锚，借其「快捷键提示美学 + 列表分组紧凑 + accent-color 系统 + 命令面板 polish」
- **优点**：
  - 跟 prompt-hub「⌥Space 唤起 + ⌘K 搜索 + ⌘1-8 相位」键盘场景极度匹配
  - Raycast 的 accent-color 体系对 prompt-hub 三色族（协议/任务/辅助）有现成可借
- **缺点**：
  - Raycast 是命令面板（单列表 + 命令），prompt-hub 是仪表盘（多面板 + 全景），结构不同导致借鉴有限
  - 借鉴范围窄，可能只够指导搜索区与状态栏
- **预估成本**：~8 天（design-spec 章节略少，但锚点局限）

### Option C: Things 3 + Notion 工具仪表盘气质锚定

- **描述**：以 Things 3 信息分层 + Notion 块化极简为锚，借「大留白 + 强字号梯度 + 块级 emphasis」
- **优点**：
  - Things 3 是工具型仪表盘标杆，信息层级表达力强
  - 大留白能彻底治掉「wireframe 紧凑感」
- **缺点**：
  - Things 3 偏「轻盈愉悦」气质，与 prompt-hub「认知缓冲」「思考的工具」气质有距离
  - 大留白与 [[03-product-spec#§4.1]] 一屏全景原则有摩擦——留白多了就放不下 4 个面板
  - 双锚点拼接，美学一致性风险高
- **预估成本**：~12 天（一屏全景与大留白的取舍需要在 design-spec 显式裁定）

### Option D: 跨产品组件级混搭

- **描述**：typography 借 Linear（字号梯度 + 字重对比）/ 间距借 Things（轻盈 + 大留白）/ 命令面板借 Raycast（accent + 列表）/ 状态借 Linear（极简反馈）
- **优点**：
  - 每个维度都选「该维度最强」的锚点
  - 表达力最强
- **缺点**：
  - 拼接美学，需要极强的设计执行力才能不糊
  - 每个组件都要权衡哪个锚点优先，决策成本高
  - 没有「一个心智锚」，未来 AI / 新人实施时仍会摇摆
- **预估成本**：~15 天 + 持续维护成本

### Option E（明示排除）：推翻反 polish 哲学

- **描述**：引入 subtle shadow / hover lift / 微 3D / glass / 渐变 accent
- **为什么排除**：这是 ADR-013+ 的范畴（先改 [[02-constitution]] 与 [[01-spec]] 才能动），不在本 ADR 决策面内
- 本 ADR Decision 一旦定，意味着「升一档质感的同时仍尊重反 polish」

## 5. Decision

> **一句话拍板**：选择 **Option A：Linear 整体气质整体锚定**，理由是 Linear 与 prompt-hub 气质同源（高密度 + 扁平 + 键盘驱动 + 工具型），单锚点最低维护成本，完全兼容色块即本体 + 反设计清单 + 一屏全景三条底线。

**为什么不选其他**：
- **不选 B（Raycast）**：Raycast 是命令面板（单列表 + 命令），prompt-hub 是多面板仪表盘，结构不同导致借鉴范围窄——只够指导搜索区与状态栏，覆盖不到主区域。Raycast 的精华可在第二阶段作为「次锚点」叠加（如搜索区借 Raycast 列表分组），但不当主锚
- **不选 C（Things 3 + Notion）**：Things 3 偏「轻盈愉悦」气质，与 prompt-hub「认知缓冲」「思考的工具」气质有距离；大留白与 [[03-product-spec#§4.1]] 一屏全景原则摩擦；且双锚点拼接美学一致性风险高
- **不选 D（跨产品组件级混搭）**：没有「一个心智锚」，未来 AI / 新人实施时仍会摇摆；每个组件都要权衡哪个锚点优先，决策成本与维护成本最高
- **不选 E（推翻反 polish）**：显式排除——本 ADR 边界是「升一档质感的同时尊重反 polish」，推翻哲学是 ADR-013+ 范畴，需先改 [[02-constitution]] 与 [[01-spec]]

## 6. Consequences

### 正向后果
- [[05-design-spec]] 从 token-only 升级到「token + 锚点 + 组合 + pattern + 状态 + icon + 权重」，新人 / AI 实施有据可依
- AI 实施 review 时可用「像不像 Linear」做单判据，省去多锚点权衡
- icon 系统统一为 SVG（Lucide 或 Phosphor，第二阶段决定），消灭 emoji 混排
- empty / loading / disabled / placeholder 状态有统一视觉规范，wireframe 残留消除
- Typography 三层梯度（标题 / 描述 / 元信息）成为强制 preset，卡片信息层次清晰
- 4 面板获得「主从权重」规则，Macro 区获得「主角光环」
- 解开 [[03-product-spec#§13]] 区域视觉契约空白

### 反向后果
- [[05-design-spec]] 篇幅从 306 行涨到 ~600 行，维护成本上升
- 「Linear-like」标签可能成为外界第一印象
- 已实现 8 组件 CSS 需配套升级（约 3 天工作量）
- mockup 文件 [[docs/mockups/prompt-hub.html]] 2997 行需重做对齐
- 第二阶段 Composition 工作台 / 沉淀视图必须按新 design-spec 实施，不能复用工程师审美的旧模式

### 未来反悔成本
- **代码改造规模**：换锚点（A → B / C / D）约 8-15 组件 CSS 重写、6 章 design-spec 重写
- **数据迁移**：无（视觉决策不涉及数据）
- **学习成本**：换锚点意味着 AI / 团队需重新建立心智参考系
- **不可逆点**：
  - 用户上线形成视觉印象后，二次换锚 = 「换了产品」
  - 锚点决定 icon family（Lucide vs Phosphor vs SF Symbols），换 icon set 是物理改组件
- **第二阶段触发条件**：若 Composition 工作台 / 沉淀视图实施时发现锚点不够用，可叠加次锚点（如 A + Raycast 借命令面板段），但不重新拍板主锚

---

## 反模式（写完自检）

- ✅ Options 4 个（A/B/C/D），E 显式排除以澄清边界
- ✅ Decision 一句话拍板 + 为什么不选其他全列
- ✅ Consequences 含「未来反悔成本」与「第二阶段触发条件」
- ✅ 不触动上游底线（色块即本体 / 反设计清单 / 一屏全景）
- ✅ Status: Accepted（2026-05-24）

## 相关链接

- **触发本决策的文档**：[[CLAUDE]]（本次会话截图实测）/ [[05-design-spec#§7]] 视觉草案未解决的问题
- **被本决策影响的文档**：
  - [[05-design-spec]] —— bump major，加 6 章
  - [[03-product-spec#§13]] —— 补区域视觉契约
  - [[docs/mockups/prompt-hub.html]] —— 重做
  - [[CLAUDE#§4.1]] —— CSS token 铁律不变
  - 8 个已实现组件 CSS（PhaseBar / MacroGrid / ScenePanel / RecentList / SopProgress / StatusBar / SearchBar / Dashboard）
- **相关 ADR**：
  - 前置 [[009-choose-styling]] CSS Modules 决策不变
  - 平行 [[002-choose-frontend-framework]] React + lucide-react 已选定（A 的 icon 落地可直接用 lucide-react）
  - 未来 ADR-013+ 若有「推翻反 polish 哲学」需求，需先改 [[02-constitution]]
