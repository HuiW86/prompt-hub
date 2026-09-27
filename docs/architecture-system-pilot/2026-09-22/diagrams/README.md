# prompt-hub 架构图的阅读与维护

先看 [架构地图](architecture-map.md) 或用浏览器打开 [HTML 地图](architecture-map.html)。D1 全景、D2 分工、D3 草稿到采纳时序、D4 删除恢复状态；每张附边界、基线、负责人、来源引用和最新检查状态。点击 SVG 可看原尺寸，PNG 用于不支持 SVG 的环境。

这些图是源码及证据支持的局部还原，不替代项目需求、人审状态或真实运行验收。外部 AI 的实际部署与接收行为保留待确认。图中的“有据”表示源码／记录有依据，不是发布验收标志。

## 唯一编辑入口

- [registry](../registry.json) 维护对象身份、名称、版本和命题。
- [views.json](views.json) 维护带证据的绘图关系清单 `facts`、各图选取范围、行为顺序、图卡及依赖文件。
- `.mmd`、`.svg`、`.png` 和两种地图是派生文件。更改清单后重新生成，避免手改图片或重复编辑原逆向文档中的图。
- [views.lock.json](views.lock.json) 是明确复核后的来源摘要；[render-manifest.json](render-manifest.json) 记录绘图版本、配置和图像摘要；[view-status.json](view-status.json) 是上一次检查结果。

## 本机复跑

在 prompt-hub 项目根执行。安装脚本及通用教程在 [绘图工作流](</Users/apple/.codex/skills/architecture-system/references/diagram-workflow.md>)。业务 package.json、pnpm-lock.yaml 和运行环境未增加绘图依赖。

```bash
ARCH_SKILL=/Users/apple/.codex/skills/architecture-system
ARCH_VIEWS=docs/architecture-system-pilot/2026-09-22/diagrams/views.json

python3 "$ARCH_SKILL/scripts/validate.py" docs/architecture-system-pilot/2026-09-22/registry.json
python3 "$ARCH_SKILL/scripts/diagram_views.py" check "$ARCH_VIEWS" --report
```

check 退出 2 表示图需要复核或重新生成，退出 1 表示输入或工具错误。读 `view-status.json` 可区分代码／对象变化与图片被改动。

```bash
# 对照来源完成复核后，只更新已复核的图；改版本描述时同步 views.json 的 baseline。
python3 "$ARCH_SKILL/scripts/diagram_views.py" baseline "$ARCH_VIEWS" --view D1 --review-note "实际变化、复核依据及仍未知的范围"
python3 "$ARCH_SKILL/scripts/diagram_views.py" build "$ARCH_VIEWS" --browser '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
python3 "$ARCH_SKILL/scripts/diagram_views.py" check "$ARCH_VIEWS" --report
```

build 不刷新来源基线。代码改了以后应在相关改动验收中执行 check；本轮未安装文件监听、Git hook 或 CI，页面只显示最近检查快照，不会自行在后台更新。迁移到其他机器时调整 Skill 和浏览器路径，按 Skill 中的独立配方安装锁定渲染器。

## 如何检查图

先检查对象、关系和基线，再打开实际 SVG／PNG：是否裁切、标签重叠、文字太小、边界或箭头含义不清。保持一图一问；长标签改成短标签＋图卡说明，不能为了好看删掉关键失败分支。

本轮可复验结果见 [绘图证据与限制](../evidence/diagram-workflow/verification.md)。工具已覆盖声明路径下新增／删除／修改文件，但不会发现未声明目录里新增的架构依赖；重构或新增能力时仍需核查依赖清单。长期维护人尚未指定。
