---
type: postmortem
project: prompt-hub
version: v0.1
created: 2026-08-05
status: closed
author: co # 🤝 人机共创（CLAUDE §5.2），人审
related:
  - learnings
  - release-runbook
  - 017-enable-auto-update
  - m0-4-macos-signing
description: v0.1.0 首次打 tag 产出「签名但未公证」的包并绿灯进 draft。直接原因是 Tauri 凭据变量名不匹配导致公证被静默跳过；深层原因是 M0-4 验证过的「能力」在无人察觉中升格成了「该能力在 CI 上确实被行使」。记录 fail-open 断言这一类缺陷的三个同形实例与自查方式。
---

# 事故复盘 — 公证被静默跳过（2026-08-05）

> 未对外发布，用户零影响。draft 在 publish 前被 runbook §3 的人工核对拦下。

---

## 1. 一句话

流水线里有一个名叫 `Build + notarize` 的步骤，**它只 build**——公证因凭据变量名不匹配被 Tauri 静默跳过，不报错、不告警，构建照样绿灯，产出的包签了名但没有公证票据，一路走到 draft release，差一步就 publish。

## 2. 事实时间线

| 时间 | 事件 |
|---|---|
| 2026-06-12 | M0-4 本地签名公证验收通过：`spctl: accepted / source=Notarized Developer ID`。证伪了「macos-private-api 会被公证拒绝」这一最坏假设 |
| 2026-06-19 | 建 Apple 相关 repo secrets（`APPLE_API_ISSUER` / `APPLE_API_KEY` / `APPLE_API_KEY_ID` / 证书三件套） |
| 2026-08-05 | 首次推 `v0.1.0` tag。build 双架构 success，sign job 审批后 success，draft release 建成，`assert-provenance.sh` 通过 |
| 2026-08-05 | 按 runbook §3 做 publish 前人工核对，`spctl` 拒绝：`source=Unnotarized Developer ID` |
| 2026-08-05 | 三重确认：`stapler validate` 对 `.app` 与 `.dmg` 均报 `does not have a ticket stapled`；build 日志从签名直接跳到 `Finished 2 bundles`，**全程无任何公证输出** |
| 2026-08-05 | 删 draft、删 tag、修凭据映射、补闸门、重打 tag。新流水线在 build 阶段硬失败并打印 Apple 原话错误——闸门生效 |

## 3. 直接原因：凭据变量名不匹配

Tauri 的 App Store Connect 公证方式只读三个变量（已对 tauri.app/distribute/sign/macos 核实）：

| Tauri 实际读取 | 语义 | 当时的 workflow |
|---|---|---|
| `APPLE_API_ISSUER` | Issuer ID（UUID） | ✅ 有 |
| `APPLE_API_KEY` | **Key ID 字符串**（10 位） | 有，但塞的是 `.p8` 文件内容 |
| `APPLE_API_KEY_PATH` | `.p8` 文件路径 | ❌ 从未设置 |
| — | — | 另传了 `APPLE_API_KEY_ID`，**Tauri 根本不读这个名字** |

Tauri 拼不出完整凭据组，于是**跳过公证并继续构建**——这是 fail-open 行为：缺失凭据被当作「用户不想公证」，而不是「用户想公证但配错了」。

## 4. 深层原因：从「能力」滑移到「行使」

真正需要解释的不是配错了变量名，而是**为什么这个错误能存活近两个月且无人复验**。

答案在 `docs/learnings.md` 信条三自己的证据里。M0-4 那次验收是真实的，结论也是对的，但它证明的命题是：

> **A：这个 app 能被 Apple 公证**（关于 macos-private-api 的属性）

而后续所有决策依赖的却是另一个命题：

> **B：发布流水线会去公证**（关于 CI 配置的属性）

A 被严谨证实之后，在无人察觉的情况下被当成了 B。证据链条清晰可见：

- HANDOFF 写下「`spctl` 仅因本地缺公证而 reject（CI 持 Apple secrets，预期）」——把本地 reject 归因于本地缺凭据，并**推断** CI 有凭据所以会公证。凭据确实有，只是名字错了
- `release-runbook.md` §3 原文写着「正式包必须通过；**本地未公证构建会 reject**」——提前为唯一的真信号准备好了借口
- workflow 注释断言「the dmg itself is signed + notarized + stapled by the same Apple creds」——注释在描述一件从未发生的事

**A 与 B 之间隔着一整套执行环境，而验证只做在 A 这一侧。**

## 5. 同一形状的三个实例

本次事故与 24 小时内另一处缺陷是同一形状，**都是断言写在命名或结构里、而不是写成可执行检查，且失败时 fail-open**：

| 实例 | 断言在哪 | 为什么 fail-open |
|---|---|---|
| `scripts/assert-provenance.sh`（`c0e6b74` 已修） | 脚本名字叫 assert | `platforms` 为空时循环零次，检查体一次都没执行就返回 0 |
| `Build + notarize` step（本次） | step 的名字 | 公证被跳过，退出码仍为 0 |
| `release-runbook.md` §3（本次已改写） | 人工检查的措辞 | 失败模式被提前解释成正常现象，真信号被读者主动丢弃 |

第三条最隐蔽：**它不是代码，是一句话**。一个检查如果预先为自己的失败准备好了借口，它就不再是检查——执行它的人会在看到红色时说服自己那是噪音。

## 6. 已落地的修复

`319f20c`：

1. **凭据映射修正**，secret→变量故意交叉并注释（仓库的 `APPLE_API_KEY_ID` 存 Key ID → 喂给 Tauri 的 `APPLE_API_KEY`；仓库的 `APPLE_API_KEY` 存 `.p8` → 写盘后喂 `APPLE_API_KEY_PATH`）
2. **`.p8` 规范化后用 `openssl pkey` 硬校验**——坏密钥响亮失败，而不是退化成又一次静默跳过
3. **新增 `Assert notarized + stapled` step**——对**产物本身**断言：`.app` 与 `.dmg` 双 `stapler validate` + `spctl -a -t exec` + `codesign --verify`
4. **runbook §3 重写**：拆分签名与公证为两组独立命令，并写明任何 reject 都不得归因于本地环境

第 3 条是本次真正的交付：**该闸门在凭据仍然配错的情况下也能拦住原缺陷**。它严格优于第 1 条——第 1 条救这一次发布，第 3 条让这一类错误再也到不了 draft。

## 7. 可迁移信条：断言要可执行，且要断言产物

> **心智模型**：一个检查的价值不取决于它叫什么，取决于它失败时会不会让流程停下来。命名、注释、step 名、文档措辞都不是断言——它们是**关于**断言的描述，而描述不会失败。

与 `learnings.md` 信条一（把纪律交给编译器）的区别：信条一讲的是**让违反变得不可能**（类型系统、依赖图红线），本条讲的是**检查存在但会放行**。前者管「做不到」，后者管「查不出」。

两条推论：

- **闸门优先于修复**。修配置只救本次；加闸门让整类错误无法通过。资源有限时先加闸门
- **自己能批的闸门不是闸门**。本次 `release-signing` 审批技术上可用 `gh api pending_deployments` 自动放行，但那样这道控制就变成空转。ADR-017 §5.5 已因单人仓库退让过一次（自批 + runbook §3 补偿核对），不能再退第二次

## 8. 自查清单

新增或复核一个检查时，逐条问：

1. **它断言的是产物还是过程？** 「跑了公证命令」和「产物带着公证票据」是两回事，只信后者
2. **它的失败路径被执行过吗？** 写完检查后主动构造一次失败，确认真的会红。`assert-provenance.sh` 的 7 用例矩阵就是这么补的
3. **零输入时它会怎样？** 空列表、空目录、空字段——循环零次而通过是 fail-open 的最常见形态
4. **文档里有没有替它的失败开脱的句子？** 「这个报错是正常的」「本地环境会这样」——每一句都在训练读者忽略真信号
5. **我验证的命题，和我依赖的命题，是同一个吗？** 「能做到 X」不等于「在生产路径上确实做了 X」
6. **这道闸门能被它要约束的人自己打开吗？** 能的话，它约束的就不是那个人

## 9. 与其他文档的关系

- `docs/learnings.md` 是跨多次踩坑抽出的长期信条；本文是单次事故的完整因果链。§7 是本文向 learnings 的候选回流内容
- `docs/release-runbook.md` 是操作手册，§3 的核对步骤是本次事故的**发现者**——它拦下了一次未公证发布，同时它自己的措辞也是成因之一
- `docs/adr/017-enable-auto-update.md` 定义了签名闸门与双 job 隔离的安全模型；本文不改变该模型，只补上它缺失的产物断言
