---
type: adr
project: prompt-hub
id: ADR-014
status: Reserved
date: 2026-05-27
description: macOS NSPanel isa-swizzle 跨版本风险占位——commit 3c736c5 已落地 isa-swizzle，Reserved 占位等触发条件之一出现再补正文
related:
  - 008-enable-macos-private-api
  - 02-constitution
---

# ADR-014: macOS NSPanel isa-swizzle 跨版本风险

## Status

`Reserved`（2026-05-27 占位）

> **为什么 Reserved 不写正文**：commit `3c736c5` 已落地 isa-swizzle（详见 [[008-enable-macos-private-api]] umbrella + commit message risk 段）。Linear / Raycast / Stats.app 实际用同一路径，当下不是「二选一」决策，强写会落入 ADR 反模式（[[000-template#反模式]]「写成需求文档而非决策记录」）。但 isa-swizzle 跨 macOS 版本风险是**独立于 ADR-008** 的新议题（ADR-008 论证「私有 API vs App Store」，未覆盖「runtime isa-swizzle vs native reparent」），完全省略会让未来 fail-fast panic 时缺乏决策溯源锚点。Reserved 占位兼得：MANIFEST 占 ADR-014 号 + 一行 description，零写作成本，触发即开正文。

## 触发条件（满足任一即开正文）

1. **macOS beta release notes 提到 NSPanel layout 变更** —— 即 `instance_size` assert 即将失败的预警，需主动评估迁移路径
2. **实测 `object_setClass` instance_size assert 触发 panic** —— `src-tauri/src/macos.rs` 中的 `assert_eq!(old_cls.instance_size(), panel_cls.instance_size(), ...)` panic（fail-fast guard，不会 silent UB）；同时存在 `AnyObject::set_class` 内部 `debug_assert_eq!` 但 release build 不触发
3. **Tauri / tao 上游加 NSPanel feature** —— Reserved 转 Accepted 走「迁移到上游原生支持」决策，对比成本

## 候选方案速记（触发后再展开）

- **A. 维持 isa-swizzle**：成本 0，已锁；风险=未来 macOS panic 时 24h hotfix（pin macOS SDK 或换 native plugin）
- **B. fork wry / 写 native plugin reparent webview**：~2-3 周工程量，彻底脱离 isa-swizzle 但引入 wry 上游 drift 维护税
- **C. 等 Tauri / tao 上游加 NSPanel feature**：成本 0 但 ETA 不可控，merge 后还需 ≥6 个月才能用到 stable

## 当前实现锚点

- `src-tauri/src/macos.rs` — `apply_nonactivating_panel()` / `order_front()` 唯一入口
- `src-tauri/src/lib.rs` setup 阶段调一次（首次 wake 前 window 已是 NSPanel）
- `src-tauri/src/commands.rs` `show_window` IPC 用同一 helper
- 测试覆盖：cargo test 12/12（不含跨版本 macOS 模拟）

## 相关链接

- 触发本决策的实际事件：commit `3c736c5`（2026-05-26 NSPanel isa-swizzle ship）
- 上位 ADR：[[008-enable-macos-private-api]]（macos-private-api umbrella，isa-swizzle 是其实现细节之一）
- HANDOFF 溯源：见 `HANDOFF.md` Risks 节「ADR-014 Reserved」指针
