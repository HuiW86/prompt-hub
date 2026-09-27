# 本轮方法反馈与实际修订

本轮先完成逆向与提炼，再将有依据的工作法写入实际安装的 `architecture-system` Skill。项目原始业务代码、用户资料和强领域规则未复制进 Skill；修改前的相关方法文件保存在 [method-before](evidence/method-before)。

## 1. 发现到修订

| 观察与依据 | 原流程缺口/已有规则 | 本轮最小修改 | 适用范围与证据限制 |
|---|---|---|---|
| 文档索引落后于本体；项目L层级表示文档分类（D01/D07） | 已有“权威划分”有效，但缺少成熟文档体系的承接提示 | reverse-analysis 增加文档职责覆盖与术语映射；case模板增加对应入口 | 已有体系/术语歧义时；不为所有小项目增加全量矩阵 |
| 无repo-write依赖仍能通过可写连接插入资产（C03，PH-CORE-PROBE） | 原先只要求区分逻辑/实现，可能把组织约束扩大成权限保证 | reverse-analysis 增加主体、入口、执行层和威胁范围 | 需要评价门控/隔离保证时；反例不是当前MCP公开工具的利用证明 |
| 采纳→恢复→再次采纳产生两个资产（C04，PH-REENTRY-PROBE） | 原规则已要求去重范围；增加可操作的状态重入检查 | capability-reuse 及capability模板明确重入、事务/调用边界 | 涉及去重、恢复、导入、人工采纳时 |
| 名称gate未核payload；工具列表只查包含；复制不等于外部发送（C02/C08） | 原规则“测试数不等于覆盖”有效，需说明如何读断言 | reverse-analysis 增加断言强度和外部效果范围 | 名称/载荷/跨系统结果场景；不强制所有测试使用同一种技术 |
| 已有设备回执、本地安全门控可比较但不可直接同义复用 | 原复用规则有效，补充共享目录查重入口 | capability-reuse和模板说明采用/特化/另立/不适用 | 已有目录时；新probe与格式引用都不算迁移 |
| 上轮规则已识别Compose UI/backend差异、历史验收不能回填 | 已有规则有效 | practice-feedback要求分别记录沿用与新增，不再叠加同义条款 | 明确要求反哺方法时 |

## 2. 实际改动位置

- [逆向参考](</Users/apple/.codex/skills/architecture-system/references/reverse-analysis.md>)：文档承接、层级语义、保证层级、测试断言。
- [能力复用参考](</Users/apple/.codex/skills/architecture-system/references/capability-reuse.md>)：目录比较、生命周期与副作用边界。
- [实作反馈参考](</Users/apple/.codex/skills/architecture-system/references/practice-feedback.md>)：已有规则与新增修订分别评价。
- [案例模板](</Users/apple/.codex/skills/architecture-system/assets/templates/case.md>)、[能力模板](</Users/apple/.codex/skills/architecture-system/assets/templates/capability.md>)：增加按需记录提示。
- [体系指南1.2](</Users/apple/WeChatProjects/架构图体系/Architecture-System-Skills-Guide.md>)、[实作记录](</Users/apple/WeChatProjects/架构图体系/Architecture-System-Practice-2026-09-22.md>)、[能力目录0.2](</Users/apple/WeChatProjects/架构图体系/capabilities/README.md>)：同步可执行方法和候选入口。
- 用户随后要求建立可直接用于AI编程的通用技能，进一步产出并安装了四个Skill，以及运行记录器和同步工具；来源、使用方式与工具测试见 [通用能力库](</Users/apple/WeChatProjects/架构图体系/Reusable-Capabilities.md>)。主架构Skill增加按需协作入口。

主 Skill 的五模式、元模型、检查器、自动触发政策及UI元信息保持原有语义。原 v1.0 框架保留历史版本，本次不另造一份同内容框架。

## 3. 检查与效果边界

检查原始输出见 [artifact-checks.json](evidence/artifact-checks.json)，精确方法差异见 [method-changes.patch](evidence/method-changes.patch)。检查覆盖：本轮registry、原结构样例、Skill元信息、相关Markdown本地链接、源代码基线未改，以及项目原文档治理工具的实际结果。治理工具若有既有警告，保留原输出，不用静态PASS代替工程验收。

最终检查：43个本地对象、4个共享引用、43条关系及5个跑次记录通过结构检查；198个本地链接无缺失；架构主Skill及四个新安装Skill元信息通过；安装副本与维护源一致。项目文档治理为0 error / 8 warning，警告均位于未改动的HANDOFF、CHANGELOG、旧计划及工作流文件。本轮初次检查的21项警告另存 [initial结果](evidence/artifact-checks-initial.json)；新增分析链接已改为项目工具兼容形式，旧方法快照改用 `.before` 后缀保留原文，避免被当成现行规范扫描，未修改治理规则。

本轮使用真实源行为回放了新增提示：能够把文档分层与图层级分开、把编译依赖与数据库权限分开、把pending去重与终身幂等分开，并据此收窄能力承诺。这属于**同案例回放**，不是独立前测。没有启动独立评估代理，没有跨项目迁移业务组件，也没有工时收益实测。新增运行记录器已在技能库实际使用并通过行为测试，其结论只覆盖该工具。

第二个不同项目说明上一轮规则已有可用性证据；对本轮新规则和三项CAP/一项PAT的下一步检验，仍应在独立采用项目中进行。候选契约成立、源组件通过、跨场景迁移通过分别维护，不能合成一个“已验证”标签。

## 4. 后续绘图路径增补

用户确认绘图建议后，已将原四图整理为 [架构地图](diagrams/architecture-map.md)，补充可编辑图源、SVG／PNG、图卡和依赖检查；逆向正文引用同一组图。共享主 Skill 新增选图菜单、八种模板、渲染及复核工具，registry v1 检查器保持兼容。具体变化与实测范围见 [绘图验证](evidence/diagram-workflow/verification.md) 和 [体系绘图实作](</Users/apple/WeChatProjects/架构图体系/Architecture-Diagrams-Practice-2026-09-22.md>)。本节是上文初次检查之后的增补，不回填先前的对象数量或检查结果。
