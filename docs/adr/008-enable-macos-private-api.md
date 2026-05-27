---
type: adr
project: prompt-hub
id: ADR-008
status: Accepted
date: 2026-05-19
description: 启用 Tauri 2.x macos-private-api feature——spec §2.3 主形态全屏覆盖透明窗口需要 NSWindow 私有 API（如 setSharingType / 非 active 仍接收事件）
related:
  - 02-constitution
  - 01-spec
  - 09-tech-stack
  - 10-ops-spec
  - 001-choose-desktop-runtime
  - 014-nspanel-isa-swizzle
---

# ADR-008: 启用 Tauri macos-private-api feature

## 1. 标题与日期

- **标题**：启用 Tauri 2.x `macos-private-api` feature，放弃未来 macOS App Store 上架的可能性
- **日期**：2026-05-19
- **决策者**：omar
- **影响范围**：[[09-tech-stack]] features 列表 / [[10-ops-spec#§1.1]] 分发渠道（永久排除 App Store）/ Tauri 配置（`tauri.conf.json` 与 `Cargo.toml` features）

## 2. Status

`Accepted`（2026-05-19）

## 3. Context

### 触发事件
[[01-spec#2.3]] 哲学三定义主形态为「全屏覆盖窗口 + 半透明背景（约 92%）」+ 快捷键唤起即时显示；这需要 NSWindow 私有 API 才能完整实现（标准 Tauri API 无法达到「主屏不被遮挡感」效果）。

### 业务约束
- [[02-constitution#A1]] 桌面原生 only — 不依赖任何应用商店发布
- [[01-spec#2.3]] 哲学三时间分离 — 主形态视觉效果决定「召之即来 + 用完即走」的心智强度

### 技术约束
- 标准 Tauri API（无 private feature）下：
  - 全屏窗口可以做，但**强制激活**（抢焦点）
  - 透明背景可以做，但**无法保持主屏 active**
  - 快捷键唤起需要先激活进程，会产生短暂闪烁
- 启用 `macos-private-api` 后能解锁：
  - NSWindow `level` 控制（如 `NSFloatingWindowLevel`，浮于所有应用上方但不抢焦点）
  - `setSharingType` 控制窗口分享行为
  - `canBecomeMain` / `canBecomeKey` 自定义（主形态唤起后立即接收键盘事件而不切换 active app）

### App Store 上架影响
- 启用 `macos-private-api` 的应用 **被 Apple 拒绝上架** App Store（违反 Mac App Store Review Guidelines 2.5.1 私有 API 禁令）
- 必须通过直链 DMG 分发 + Apple Developer ID 签名 + notarization（已在 [[10-ops-spec#§1.2]] 涵盖）

### 不决策的代价
- 主形态效果打折（强制激活 / 闪烁），破坏 [[01-spec#2.3]] 召之即来心智
- Tauri 项目模板默认配置无法直接启动 prompt-hub MVP（features 字段需在第一行代码前确定）

## 4. Options Considered

### Option A: 启用 `macos-private-api`

- **描述**：在 `Cargo.toml` 的 tauri dependency 中加 `features = ["macos-private-api"]`，并在 `tauri.conf.json` 启用对应窗口配置
- **优点**：
  - 主形态全屏覆盖 + 透明 + 不抢焦点完整可达
  - 快捷键唤起无闪烁（NSWindow level 控制）
  - [[01-spec#2.3]] 哲学三时间分离效果完整
- **缺点**：
  - 永久放弃 macOS App Store 上架可能性
  - 未来 Apple 若调整私有 API 行为，需重新评估（但通常向后兼容）
  - 代码签名注意事项：notarization 仍需做，私有 API 不影响 notarization 通过
- **预估成本**：features 配置 1 行；窗口管理 Rust 代码增加 ~50-100 LOC

### Option B: 不启用 `macos-private-api`

- **描述**：保留 App Store 上架可能性，主形态用标准 API 模拟
- **优点**：保留分发选项
- **缺点**：
  - 主形态视觉效果打折（强制激活 / 闪烁）
  - 与 [[01-spec#2.3]] 哲学三冲突
  - App Store 上架本就不在 prompt-hub 路线图（[[10-ops-spec#§1.1]] 标 v2.0+ 才考虑）
- **预估成本**：标准 API 实现窗口动画 / 状态切换 LOC 略多，体验仍差

## 5. Decision

> **一句话拍板**：**启用** `macos-private-api`，理由是 [[01-spec#2.3]] 哲学三时间分离的视觉强度优先于不在路线图内的 App Store 上架可能。

**为什么不选其他**：
- 不选 Option B（不启用）因为：主形态视觉效果打折直接破坏 [[01-spec#2.3]] 召之即来心智；App Store 上架在 [[10-ops-spec#§1.1]] 本就标 v2.0+，决策成本极低

## 6. Consequences

### 正向后果
- 解锁主形态完整视觉效果（全屏覆盖 + 透明 + 不抢焦点 + 无闪烁）
- [[01-spec#2.3]] 哲学三时间分离心智完整保留
- [[10-ops-spec#§1.1]] 分发渠道明确为 DMG 直链 + tauri-plugin-updater（无歧义）

### 反向后果
- **永久关闭** macOS App Store 上架可能性
- 未来若 omar 决定上架 App Store，需重新决议（开新 ADR superseded by NNN，并重写主形态窗口管理代码用标准 API）
- 私有 API 行为依赖 macOS 版本，需要在 ops-spec 中加 「macOS 版本兼容性测试」 章节（待 [[10-ops-spec]] 补）

### 未来反悔成本
- **代码改造规模**：主形态窗口管理 ~50-100 LOC 重写为标准 API
- **数据迁移**：无
- **学习成本**：低
- **不可逆点**：
  - 用户已习惯私有 API 视觉效果后，回退到标准 API 会感到「降级」
  - 若已分发 v1.x 版本基数大，强制升级到不依赖私有 API 的 v2.0 等同视觉降级，可能引发负面反馈

---

## 反模式（写完自检）

- ✅ Options 2 个（启用 / 不启用）
- ✅ Decision 一句话 + 明确放弃 App Store
- ✅ 反悔成本含「视觉降级用户反馈」

## 相关链接

- **触发本决策的文档**：[[01-spec#2.3]] / [[09-tech-stack#§3]] / [[10-ops-spec#§1.1]]
- **被本决策影响的文档**：[[09-tech-stack]] features 字段 / [[10-ops-spec#§1.1]] App Store 行的标注 / Tauri 配置文件
- **相关 ADR**：前置 ADR-001（Tauri 2.x）；下游 [[014-nspanel-isa-swizzle]]（Reserved，跨 macOS 版本风险触发后补正文，2026-05-27 commit `3c736c5` 落地 isa-swizzle 后占位）
