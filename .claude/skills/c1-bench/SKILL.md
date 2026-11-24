---
name: c1-bench
description: prompt-hub 改动碰到主形态唤起路径（全局快捷键、窗口 show/focus、唤起时首屏渲染的组件、wake 事件）时加载。说明怎么跑 hotkey-wake / cold-start 基准、怎么判 C1（≤200ms P95）、基线在哪、哪些情况必须先定位再合并。
---

# C1 唤起基准（prompt-hub）

宪法 [[02-constitution#C1]]：全局快捷键到窗口可交互 ≤ 200ms（P95），违反即项目转型。`CLAUDE.md` §4.4 要求：**涉及主形态启动路径的改动必须附 benchmark 结果**。

## 什么时候必须跑

- 改了 `src-tauri/src/lib.rs` 的唤起链路（`wake_on_main_thread`、`emit_wake`）、`src-tauri/src/macos.rs`（non-activating panel / isa-swizzle）、全局快捷键注册
- 改了唤起后**首屏**渲染的东西：`src/App.tsx` 的唤起处理、全景（`src/components/panorama/`）首屏、唤起时触发的 store 刷新
- 拿不准时就跑：只能在 macOS 本机跑（要真窗口），云端 Linux 会话跑不了，**照实在 PR 里写「未跑，原因」**，不要编数字

## 怎么跑

```bash
pnpm bench:hotkey-wake                    # C1 判据：show()+set_focus() Rust 调用 P95；P95 > 200ms 退出码 1
pnpm bench:cold-start                     # spawn → 首次 CGWindow entry；非 C1 约束（目标 ≤1.5s；脚本不判这个数，只打印供对比）
BENCH_ROUNDS=50 pnpm bench:cold-start     # 只有 cold-start 读 BENCH_ROUNDS（默认 20）
```

- 两个 bench 都在 `mkdtemp` 出的一次性 `HOME` 里跑空库，**不碰真实资产库**（`bench/*.bench.mjs` 的 `makeSandboxHome`）。早于这一改动的 cold-start 数字取自真实库，不可直接比较。
- hotkey-wake 测的是 Rust 侧 `show()+set_focus()`，**不含** OS 快捷键分发（约 10ms）。轮数写死在 `src-tauri/src/bench.rs`（`WARMUP_ROUNDS` 5 轮预热 + `SAMPLE_ROUNDS` 50 轮采样），不读环境变量。
- 本机 shell 若在 Rosetta 下，前端命令包 `arch -arm64 /bin/zsh -lc '…'`（[[learnings]] 附录 B.3）。

## 怎么判

| 结果 | 动作 |
|---|---|
| 退出码 1（P95 > 200ms） | 违反 C1，不得合并 |
| 比上次基线明显上涨 | **先定位再合并**（2026-11-13 已约定：上一次 +42% 未定位，再涨须先查清） |
| stderr 出现 `isa-swizzle skipped` | 窗口静默降级成抢焦点的普通窗口，数字不可信——当失败处理 |
| 与基线同档 | PR 里贴 p50 / p95 / 轮数 |

**基线与历次复测只记在** [[11-test-spec]] §5（性能基准表）——跑完把新数字记到那里（记录类，按 `doc-change` skill 的反查归档走），不要写进 `CLAUDE.md`。

## CI 现状

`.github/workflows/ci.yml` 的 `bench-c1` 只在 push 到 `main` 或手动触发（`workflow_dispatch`）时跑、PR 上不跑，且仍是 `continue-on-error: true`——**CI 上 C1 不设防**，本机这一跑是唯一真正的闸门（积压见 GitHub issue「积压 · CI / 发布」第 10 / 56 项）。
