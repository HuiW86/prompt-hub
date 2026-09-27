# 绘图增补的验证与限制

日期：2026-09-22 本机时间；原始记录使用 UTC。源代码基线仍为 `317106deaef72b5edc83a74bd63402bd1b4ac6c2`。本轮只增加或更新分析产物及共享方法工具，未修改业务源码、真实数据或业务依赖。

## 实际运行

- 四张项目图均通过结构引用检查、Mermaid CLI 11.17.0 实际 SVG／PNG 渲染和声明依赖检查。见 [构建原始输出](build.json)、[stderr](build.stderr)、[渲染清单](../../diagrams/render-manifest.json)、[检查快照](../../diagrams/view-status.json)。
- 工具在本机使用独立的 pnpm 锁定配方及已有 Chrome；没有将绘图依赖加入 prompt-hub。实际环境版本与工具文件摘要保存在 [最终检查](checks.json)。
- 16 项工具行为测试通过，原始输出位于 [共享工具测试](</Users/apple/WeChatProjects/架构图体系/evidence/2026-09-22/diagram-tool/tests.stderr>)。测试在临时目录修改模拟文件，未对项目源文件注入变化。
- 八种通用模板在临时目录实际完成渲染，见 [模板运行](</Users/apple/WeChatProjects/架构图体系/evidence/2026-09-22/diagram-tool/template-runs.json>)。draw.io 模板只检查 XML 结构；未在编辑器里验证，也没有物理接线验收。
- registry v1、既有 registry 样例、Skill 元信息及相关本地链接执行独立检查，见 checks.json。registry 本轮补充桌面应用和外部边界对象；之前 43 对象的检查保留历史含义。

## 图像与语义复核

Codex 通过本地图像查看工具逐张查看 D1–D4 的实际 PNG，不以图源存在代替可读性检查。首轮发现并修正：D4 自循环标签重叠；D3 长文字折行及参与者高度不足；D1 分组多行标题裁切。最终四图未见文字裁切或标签互相遮挡。D2 较长、D3 较宽，地图提供 SVG 原尺寸入口，缩略图不能代替详细阅读。

D1 区分整个本机系统与桌面应用；外部客户端实际部署和粘贴行为保留待确认。D2 区分 WebView、Rust 宿主、独立 MCP 进程和共享库职责；repo-core 不画成共享运行服务。D3 补宿主与仓储边界，明确省略的收件箱读取往返；事务前 pending 检查失败不进入事务。D4 使用短转换标签，依赖恢复、唯一约束和清空保留分支在图卡说明。

“有据”来自对应 C01–C10 和源码／测试记录；没有重新执行原生应用、业务全套测试、性能或发布验收，也没有代替人审签字。

## 持续维护范围

check 检查声明文件／glob 的内容与匹配列表、所引对象／命题／证据元数据、视图关系及图像摘要。源代码改变后可在验收命令中执行 `check --report`，自动标记受影响图；不因为其他提交导致全图过期。build 不会偷偷更新来源基线。

本轮未安装后台监听、Git hook 或 CI。未声明路径中的新架构依赖、证据是否真正支持某个箭头、跨机器字体差异和人的理解效果，仍需后续实际复核。新工具未经过第二个实际项目独立采用或独立代理前测。

原始图源及修改前方法文件保存在 [before](before)；现行可编辑入口见 [绘图说明](../../diagrams/README.md)。共享工作法及入口更新见 [体系实作](</Users/apple/WeChatProjects/架构图体系/Architecture-Diagrams-Practice-2026-09-22.md>)。
