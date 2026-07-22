---
type: adr
project: prompt-hub
status: accepted
description: 主形态视觉身份定为深色驾驶舱 + 恒定 violet 品牌色；light 降为显式设置项（推翻 ADR-018 补遗"light 为参考观感"锚点）
---

# ADR-024: 深色驾驶舱身份 + 恒定品牌色

## 1. 标题与日期

- **标题**：主形态默认恒定深色（不随 OS 亮暗），violet 定为独立于 accent 设置的品牌 token；协议舱当前相位主角化、Macro 命令牌化
- **日期**：2026-07-21
- **决策者**：omar（"完全重构"授权 + AI 具体设计），AI 记录
- **影响范围**：tokens.css（`--brand-*`、light 触发方式、`--t-15/--t-18`）、settingsStore（默认 themeMode=dark + v2 迁移）、PhaseBar/MacroGrid/RecentList/Header/StatusBar/primitives 表现层、design-spec §2/§8、ADR-018 补遗锚点

## 2. Status

`Accepted`（2026-07-21；omar 反馈"重塑 = 换色以外的整体重构"后授权 AI 自主设计落地，实机截图验收制）

## 3. Context

- 重塑 W1–W6 忠实落地既有克制体系后，omar 实机反馈"和原来一样"——克制语言（跟随系统亮暗 + 全中性 + subtle elevation）的表现力天花板不满足"优秀水位"
- 哲学三（时间分离）支持恒定深色：唤起的 overlay 与桌面形成模式切换感，跟随 OS 反而削弱分离
- ADR-019 已裁决"颜色不承载 ontology"——品牌色是身份维度不是资产语义，不与 B2 冲突

## 4. Options Considered

### Option A: 维持跟随系统 + 三选一 token 微调
- 被 omar 实机否决（"几乎是换了个颜色"）

### Option B: 深色驾驶舱身份 + 品牌 token + 组件表现层重做 ✅
- **优点**：气质彻底改变；分离感物理化；brand 独立于 accent 使身份稳定；表现层重做不动行为层，314 测试兜底
- **缺点**：偏离 Promptscape light 参考稿；亮色环境用户需显式切换

### Option C: 全新信息架构（推倒六区）
- 超出 product-spec §13 契约与本轮授权；六区结构本身未被否定

## 5. Decision

> **一句话拍板**：选 B——深色为身份默认（light 仅显式设置，v2 迁移一次性重置旧默认），新增 `--brand`(#8b7bff) 系恒定 token 用于身份时刻（logo/活动相位/Macro 图标芯片/时间线焦点），协议舱活动相位升 display 层级（18px + flex-grow + brand 标记），Macro 升命令牌（56px + 15px/600 + brand 芯片），Recent 升时间线形态。

**为什么不选其他**：A 已被用户实机否决；C 推翻的是未被否定的结构契约。

## 6. Consequences

### 正向后果
- "先定框"（哲学七）首次获得与其地位相称的视觉主角性
- 品牌身份与用户 accent 偏好解耦，accent 回归焦点环/强调的本职

### 反向后果
- ADR-018 补遗"light 为参考观感"锚点被推翻（同类先例：ADR-019 推翻 ADR-012）；CLAUDE-DESIGN 稿基调需下轮同步
- settingsStore persist v2 迁移会重置既装机器的 themeMode 一次

### 未来反悔成本
- token + CSS 层可逆（git revert）；persist 迁移不可逆但影响仅主题偏好一项

## 相关链接

- 触发：ADR-023（重塑决议）+ omar 2026-07-21 实机反馈
- 影响：[[05-design-spec]] §2/§8/§9（下轮八步回流）、[[CLAUDE-DESIGN]]
- 相关：ADR-018（部分锚点被本 ADR 推翻）、ADR-019（颜色语义裁决，本 ADR 遵守）、ADR-020（暗 band 与本方向天然融合）
