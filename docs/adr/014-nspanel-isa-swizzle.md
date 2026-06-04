---
type: adr
project: prompt-hub
id: ADR-014
status: Accepted
date: 2026-06-03
description: macOS overlay 用 NSPanel 子类（override canBecomeKeyWindow）+ isa-swizzle，而非裸 NSPanel reparent / 加 Titled style bit / fork wry——borderless 窗口需子类覆写才能成为 key window 接收键盘
related:
  - 008-enable-macos-private-api
  - 02-constitution
---

# ADR-014: macOS overlay 用 NSPanel 子类 isa-swizzle 取得 key-window 资格

## 1. 标题与日期

- **标题**：选择 `define_class!` NSPanel 子类（override `canBecomeKeyWindow`）+ isa-swizzle，作为 borderless 非激活 overlay 取得键盘焦点的方案
- **日期**：2026-06-03
- **决策者**：Mauna Loa（codex + 实测三方确认）
- **影响范围**：`src-tauri/src/macos.rs` / `lib.rs` / `commands.rs`；上位 [[008-enable-macos-private-api]]；约束 [[02-constitution#C1]] 唤起 + spec §1.1「悬浮不抢焦点」

## 2. Status

`Accepted`（2026-06-03 由 Reserved 转正——触发条件 #2 的变体命中：实测 borderless NSPanel 无法成为 key window，键盘事件全失效）

> 2026-05-27 本 ADR 以 `Reserved` 占位（commit `3c736c5` 已 ship 裸 isa-swizzle，当下非二选一决策）。ADR-012 Phase 5 人工验收时发现 overlay 唤起后**完全不接收键盘**（搜索框不可输入、⌘1–⌘8/⌘K 失效，鼠标正常），根因迫使从「维持 isa-swizzle vs 迁移」升级为「如何让 borderless 窗口成为 key window」的真实决策，转 Accepted。

## 3. Context

- **触发事件**：ADR-012 Phase 5 肉眼验收时，全局快捷键唤起的 overlay 窗口可见但接收不到任何键盘输入。实测探针证明：`class="NSPanel" canBecomeKey=false` → AppKit 只向 key window 投递键盘事件，故 `makeKeyWindow()` 是 no-op。
- **业务约束**：spec §1.1「悬浮于所有 app 之上但**不抢焦点**」——不能用 `activateIgnoringOtherApps:` 把整个 app 激活到前台；[[02-constitution#C1]] 唤起 ≤200ms，方案不能引入重初始化。
- **技术约束**：tao 创建的是 `TaoWindow`（NSWindow 子类）；borderless 窗口（无 `Titled` style bit）即便 isa-swizzle 成裸 `NSPanel`，其默认 `canBecomeKeyWindow` 仍返回 `NO`，`makeKeyWindow` 无效。`object_setClass` 要求新旧类 `instance_size` 相等。
- **不决策的代价**：overlay 永远不可键盘输入 = 主形态（快捷键唤起搜索/调用）完全不可用，违反 spec §1.1 核心交互。

## 4. Options Considered

### Option A: NSPanel 子类 override `canBecomeKeyWindow` + isa-swizzle（采纳）

- **描述**：`define_class!` 定义 `PromptHubKeyablePanel : NSPanel`，覆写 `canBecomeKeyWindow`/`canBecomeMainWindow` → `true`；isa-swizzle 目标从裸 `NSPanel` 改指向此子类。子类不加 ivar，`instance_size` 与 NSPanel 相等，沿用既有 size assert 守护。
- **优点**：
  - Raycast / tauri-nspanel 的已验证路径，borderless 窗口可成为 key window
  - 子类无 ivar → instance_size 不变，isa-swizzle 仍合法，零额外风险面
  - 配合 `becomesKeyOnlyIfNeeded(false)`，WKWebView 内文本框点击即可让 panel 成 key，键盘直达 web content
  - 成本接近 0，不引入新依赖，不触碰唤起性能预算
- **缺点**：
  - 仍是 runtime isa-swizzle，跨 macOS 版本风险未消除（继承自原占位议题）
  - 依赖私有 NonactivatingPanel 行为（已被 [[008-enable-macos-private-api]] 接受）
- **预估成本**：已落地，~30 行 Rust（commit `59baaad`）

### Option B: 给窗口加 `Titled` style bit 使其可成 key

- **描述**：保留裸 NSPanel，额外打开 `Titled` style mask 让默认 `canBecomeKeyWindow` 返回 `YES`。
- **优点**：不需自定义子类
- **缺点**：`Titled` 会带回标题栏/边框渲染语义，破坏 borderless 全屏 overlay 外观（[[05-design-spec]] 无边框悬浮帧），需再叠 hack 隐藏，得不偿失
- **预估成本**：低工时但引入视觉回归与额外遮蔽逻辑

### Option C: fork wry / 写 native plugin reparent webview

- **描述**：脱离 isa-swizzle，原生重新挂载 webview 到自建 NSPanel。
- **优点**：彻底摆脱 isa-swizzle 跨版本风险
- **缺点**：~2–3 周工程量 + wry 上游 drift 长期维护税
- **预估成本**：高（数周）

### Option D: 等 Tauri / tao 上游加 NSPanel feature

- **描述**：等上游原生支持非激活 panel。
- **优点**：成本 0
- **缺点**：ETA 不可控，merge 后 ≥6 个月才进 stable，阻塞主形态可用性
- **预估成本**：0 但不可控，无法解眼前 blocker

## 5. Decision

> **一句话拍板**：选择 Option A——用 `define_class!` 的 `PromptHubKeyablePanel : NSPanel` 子类覆写 `canBecomeKeyWindow` 并 isa-swizzle 到它，因为这是让 borderless 非激活 overlay 取得 key-window 资格的唯一零成本且不破坏「不抢焦点 / 无边框」约束的路径。

**为什么不选其他**：
- 不选 B 因为：`Titled` style bit 会破坏无边框悬浮外观，需再叠遮蔽 hack，净复杂度更高
- 不选 C 因为：数周工程量 + wry 上游维护税，为眼前 blocker 严重过度投入
- 不选 D 因为：上游 ETA 不可控，会无限期阻塞主形态键盘交互

## 6. Consequences

### 正向后果
- overlay 唤起后可键盘输入（搜索框 + ⌘1–⌘8/⌘K），主形态交互闭环（spec §1.1 达成）
- 统一 `macos::wake()`（order_front → make_key → focus_view）消除多唤起路径焦点漂移
- 子类无 ivar，既有 instance_size assert 继续作为 fail-fast 守护，无新增不变量

### 反向后果
- 仍依赖 runtime isa-swizzle + 私有 NonactivatingPanel，跨 macOS 版本风险继承未消
- `wake` 序列对 AppKit key-window 语义耦合更深，未来若上游改 firstResponder/key 行为需同步排查

### 未来反悔成本

- **代码改造规模**：~5 文件、子类 + wake 序列约 60 LOC；切到 Option C 需数周
- **数据迁移**：无（纯窗口层）
- **学习成本**：维持现状无；切 native reparent 需吃透 wry/webview 挂载
- **不可逆点**：无硬不可逆点；isa-swizzle 可随时换实现，但子类语义已被 lib/commands 两处 wake 依赖

---

## 触发监控（保留——Accepted 后仍需盯）

下列任一出现需重新评估是否迁移 Option C/D：

1. **macOS beta release notes 提到 NSPanel layout / instance_size 变更** —— size assert 即将失败的预警
2. **`object_setClass` instance_size assert 触发 panic** —— `apply_nonactivating_panel` 中 `assert_eq!(old_cls.instance_size(), panel_cls.instance_size(), ...)` fail-fast（不会 silent UB）
3. **Tauri / tao 上游加 NSPanel / 非激活 panel feature** —— 走「迁移到上游原生支持」对比

## 当前实现锚点

- `src-tauri/src/macos.rs`：
  - `define_class!` `PromptHubKeyablePanel : NSPanel`（override `canBecomeKeyWindow`/`canBecomeMainWindow`）
  - `apply_nonactivating_panel()`：isa-swizzle 到子类 + size assert + `setBecomesKeyOnlyIfNeeded(false)` + NonactivatingPanel style + collection behavior + level
  - `wake()` = `order_front` → `make_key`（`makeKeyWindow`）→ `focus_view`（`makeFirstResponder`）单一唤起序列
- `src-tauri/src/lib.rs` setup + global-shortcut handler、`src-tauri/src/commands.rs` `show_window` IPC 均调 `macos::wake()`
- 测试覆盖：cargo test --workspace（不含跨版本 macOS 模拟，子类语义靠实测验收 + size assert 守护）

## 相关链接

- 触发本决策的实际事件：commit `3c736c5`（2026-05-26 裸 isa-swizzle ship）+ commit `59baaad`（2026-06-03 子类 + key-window 修复）
- 上位 ADR：[[008-enable-macos-private-api]]（macos-private-api umbrella，isa-swizzle 是其实现细节之一）
- HANDOFF 溯源：见 `HANDOFF.md`「overlay panel keyboard-focus fix」会话
