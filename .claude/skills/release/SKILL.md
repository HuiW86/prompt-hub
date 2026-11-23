---
name: release
description: prompt-hub 准备发版（改版本号、打 v* tag、审批 sign job、publish、验证自动更新）时加载。先做三条最容易踩的发版前检查，再按 docs/release-runbook.md 逐节执行；坏包急停与密钥轮换也在 runbook 里。
---

# 发版（prompt-hub）

**操作手册的唯一真相源是 `docs/release-runbook.md`**，本 skill 不复述它，只补 runbook 之外、出过事的三条前置检查。

## 动手前三查

1. **版本号必须高于 GitHub 上最新已发布的 tag**——先查 Releases，不要信对话、HANDOFF 或记忆里的「还没发版」。曾经误以为 0.2.2 未发布，而它早已公开；同号不同内容会让已装客户端永远收不到更新。版本号三处同改（`package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml`），由 `bash scripts/check-version.sh <版本>` 把关。
2. **`user_version` 迁移不可逆**：新版若带 migration，装上后不能降回旧二进制。反悔的做法是新开 migration 标废弃，不是降版本（[[learnings]] 附录 B.2）。MCP 二进制共享同库，须与主 app 同批分发。
3. **签名证书有效期**：Developer ID 证书 2027-02-01 到期（[[learnings]] 附录 B.2）。临近到期先续，否则公证会在 CI 中途失败。

## 然后按 runbook 走

| 节 | 做什么 | 谁能做 |
|---|---|---|
| §1 / §1.5 | 全量测试 + 版本三元组 + 凭据自检 | 云端会话可做测试部分；凭据自检要本机 |
| §2 | 打 tag 触发流水线，**7 天内**审批 sign job | **只能本机**：云端会话推 tag 会被代理 403 |
| §3 | 下载 draft 资产强制本地核对（单人发版的补偿控制，不可跳过） | 本机 |
| §4 | publish，并用上一版客户端走一遍「检查更新」；更新后再验一次签名链 | 本机 |

云端会话能做的只到 §1：准备版本号改动、跑测试、起草发布说明（`docs/release-notes/`），然后把 §2 起交给使用者在本机执行。

## 发完之后

- CHANGELOG 记一行（版本、tag 指向的 commit、schema 版本）。
- `CLAUDE.md` §7「当前状态指针」只更新「最新公开版」一个字段，不写叙事。
