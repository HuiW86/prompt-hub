---
type: adr
project: prompt-hub
id: ADR-003
status: Accepted
date: 2026-05-19
description: 选择 rusqlite 0.32 + bundled SQLite 作为数据持久化层；不启 SQLCipher 整库加密——A2 本地优先+不上云已达隐私底线，整库加密引入 master password 破坏召之即来
related:
  - 02-constitution
  - 01-spec
  - 06-prd
  - 09-tech-stack
  - 001-choose-desktop-runtime
---

# ADR-003: 选择 rusqlite 0.32 + bundled SQLite（不启用 SQLCipher）

## 1. 标题与日期

- **标题**：选择 rusqlite 0.32 + bundled SQLite 作为数据持久化层；不启用 SQLCipher 整库加密
- **日期**：2026-05-19
- **决策者**：omar
- **影响范围**：[[09-tech-stack#§3-D3]] resolved / [[06-prd#数据模型]] schema 设计 / [[10-ops-spec#§3]] 备份策略（影响备份文件是否加密）/ [[10-ops-spec#§1.1]] 分发包大小（bundled SQLite 增加 ~1MB）

## 2. Status

`Accepted`（2026-05-19）

## 3. Context

### 触发事件
[[06-prd#数据模型]] 定义了 Modifier / Composition / Macro / UsageRecord / SOP 等 ≥5 个关联实体，UsageRecord 增长后需 query/index，[[001-choose-desktop-runtime]] 锁定 Tauri 2.x（Rust 后端），数据持久化层是 MVP 必决。

### 业务约束
- [[02-constitution#A2]] 本地优先 + 无服务端 — 排除任何远程数据层
- [[02-constitution#A3]] 单人单机 — 无多用户隔离需求
- [[01-spec#8.2]] 话术「含工作指纹」属于隐私敏感数据 — 决定是否需要整库加密的核心判断点
- [[02-constitution#C1]] 主形态 200ms 唤起 — 数据层启动 + 查询开销不能拖累

### 技术约束
- 与 Tauri 2.x Rust 后端集成
- 数据规模预估：Modifier ≤5000 / Composition ≤1000 / Macro ≤100 / UsageRecord 增长无上限（按月归档）
- 需要关系查询 + 索引（如按 Modifier 反查 Composition 引用 / UsageRecord 时间范围 query）

### 参考验证
VaultX 用 `rusqlite 0.32 + bundled SQLCipher` 实战验证 Tauri 2.x + Rust 数据层；本决策借鉴 rusqlite 选型，但 **不启 SQLCipher** —— prompt-hub 与 VaultX 的安全等级不同（话术 vs 密码）。

### 不决策的代价
- [[06-prd]] 字段级 schema 无法实施
- UsageRecord 写入路径无法实现
- 数据备份策略（[[10-ops-spec#§3]]）无法定型

## 4. Options Considered

### Option A: rusqlite 0.32 + bundled SQLite（不启 SQLCipher）

- **描述**：纯 SQLite 整库不加密；rusqlite Rust 绑定 + bundled feature 编译时打包 SQLite，无运行时系统依赖
- **优点**：
  - 关系查询 / 索引 / 外键 / 事务全部满足
  - bundled SQLite 跨 OS 行为一致（与 macOS 系统 SQLite 版本解耦）
  - 启动 zero overhead — 直接 open file，无解锁交互（契合 C1 200ms 唤起）
  - 性能富余：prompt-hub 数据规模在 SQLite 单库轻松承载
  - 备份策略简单（直接 cp .db 文件 + WAL）
- **缺点**：
  - .db 文件未加密 — 物理访问者（如电脑被偷）可直接读
  - 但 [[02-constitution#A2]] 已声明「不上云 + 本地优先」是隐私底线，OS 用户登录密码 + FileVault（macOS 默认）已是第一道防线
- **预估成本**：rusqlite 学习曲线低，建仓 1-2 天可跑通 CRUD

### Option B: rusqlite 0.32 + bundled SQLCipher（整库加密）

- **描述**：SQLite + 加密扩展，所有读写需要 master password 派生密钥
- **优点**：物理访问者也无法直读 .db 文件；与 VaultX 完全一致
- **缺点**：
  - 需要 master password 解锁流程 — **破坏 [[01-spec#2.3]] 「召之即来」哲学**（每次启动都要输密码）
  - C1 200ms 唤起在 Argon2 密钥派生场景不可能达成（典型 300-500ms）
  - 备份文件也加密 — 用户跨设备恢复需带 master password，增加心智负担
  - prompt-hub 不是凭证管理器，安全等级与 VaultX 不对等
- **预估成本**：解锁交互 + 密钥管理需额外 ~500 LOC

### Option C: JSON 文件 + 内存索引

- **描述**：每个实体一个 JSON 文件，启动时全量加载内存
- **优点**：实现简单、文件可直接 git diff
- **缺点**：
  - UsageRecord 增长后启动加载时间线性恶化（违反 C1）
  - 无原子事务、并发写易损坏
  - 复杂 query 需手写索引代码
  - 单文件 > 64KB 时 git diff 失去意义
- **预估成本**：初期最快，但 ≥1000 条 UsageRecord 后必重构

### Option D: Tauri Store plugin（基于序列化 JSON 的 KV store）

- **描述**：Tauri 官方 KV 存储 plugin
- **优点**：开箱即用、跨 OS
- **缺点**：仅 KV 接口，prompt-hub 关系数据需求超出能力；同 Option C 增长后性能问题
- **预估成本**：MVP 快但中后期必换

## 5. Decision

> **一句话拍板**：选择 **rusqlite 0.32 + bundled SQLite**，**不启 SQLCipher** —— A2 本地优先 + 不上云已达 prompt-hub 隐私底线，整库加密引入解锁交互破坏 C1 召之即来。

**为什么不选其他**：
- 不选 Option B（SQLCipher）因为：master password 解锁与 [[01-spec#2.3]] 召之即来哲学正面冲突，C1 200ms 唤起不可达
- 不选 Option C（JSON）因为：UsageRecord 增长后性能崩盘
- 不选 Option D（Tauri Store）因为：仅 KV 接口，关系数据需求超出

## 6. Consequences

### 正向后果
- 解 [[09-tech-stack#§3-D3]]
- [[06-prd]] 字段级 schema 可直接落地
- [[10-ops-spec#§3]] 备份策略简化为「cp .db + WAL」
- C1 200ms 唤起的数据层零负担
- 跨设备恢复无需带密钥
- 与 [[01-spec#2.3]] 召之即来哲学一致

### 反向后果
- .db 文件物理访问者可直读 — 依赖 OS 层安全（用户密码 + FileVault）
- 未来若敏感度升级（如要支持「私密话术」分类需加密），需重新决议引入字段级加密（而非整库）
- bundled SQLite 增加包体 ~1MB（在 Tauri 10-20MB 量级中可忽略）

### 未来反悔成本
- **代码改造规模**：约 5-15 个文件（数据访问层 + 启动流程）
- **数据迁移**：需写 migration 脚本将明文 .db 加密导出（user 一次性操作）
- **学习成本**：低 — 加密层透明集成
- **不可逆点**：若用户已分发明文 .db 备份在多处（如 iCloud / 其他磁盘），切换到加密后无法事后追溯销毁明文副本

---

## 反模式（写完自检）

- ✅ Options 4 个
- ✅ Decision 一句话（含 yes/no 两层决策）
- ✅ 反向后果 + 反悔成本含「事后追溯销毁明文」这种隐性不可逆点

## 相关链接

- **触发本决策的文档**：[[09-tech-stack#§3-D3]] / [[06-prd#数据模型]] / [[01-spec#8.2]] / [[02-constitution#A2]] / [[02-constitution#C1]]
- **被本决策影响的文档**：[[06-prd]] / [[10-ops-spec#§3]] / [[10-ops-spec#§1.1]]
- **相关 ADR**：前置 ADR-001 / 同期 ADR-002 / 未来若需字段级加密 → 新开 ADR-NNN
