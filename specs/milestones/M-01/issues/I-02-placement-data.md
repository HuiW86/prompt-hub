```yaml
id: I-02
milestone: M-01
title: 布局数据层：panorama_placements 表、两个命令、导出 1.5
type: feature
risk: R2
depends_on: []
creates:
  - src-tauri/crates/repo-core/migrations/0016_panorama_placements.sql
  - src-tauri/crates/repo-core/src/panorama.rs
  - src-tauri/crates/repo-write/src/panorama.rs
modifies:
  - src-tauri/crates/repo-core/src/db.rs
  - src-tauri/crates/repo-core/src/lib.rs
  - src-tauri/crates/repo-core/src/export.rs
  - src-tauri/crates/repo-write/src/lib.rs
  - src-tauri/crates/repo-write/src/import.rs
  - src-tauri/src/commands.rs
  - src-tauri/src/lib.rs
  - src/ipc/index.ts
  - src/ipc/types.ts
  - src/ipc/ipc-contract.test.ts
verify: cargo test --workspace --manifest-path src-tauri/Cargo.toml panorama && pnpm test -- src/ipc/ipc-contract.test.ts
github: 8
human_review: required   # R2：数据结构与迁移
```

# I-02 布局数据层

## 目标

让「每条条目在全景的哪一列、占哪个常用位」可以保存、读取，并随导出导入保留。

## 背景

- 全景面板（M-01）按六个意图列加两个底部分组显示全部条目，用户可指定九个常用位。
- 布局是视图信息，不是资产。存进一张独立的表，不给五张资产表加列，这样不触碰软删除闸门（`src/ipc/soft-delete-gate.test.ts` 的 `ASSET_TABLES`），也不违反宪法 B1。
- 现状：`PRAGMA user_version` = 15，迁移登记在 `src-tauri/crates/repo-core/src/db.rs` 的 `MIGRATIONS`；导出版本常量 `DATA_SCHEMA_VERSION = "1.4"` 在 `repo-core/src/export.rs`；`ExportBundle.website_library` 是可选字段的先例；命令数闸门 `EXPECTED_COMMAND_COUNT = 71` 在 `src/ipc/ipc-contract.test.ts`。
- 导入是整库替换，见 `repo-write/src/import.rs`。

## 接口（I-03、I-04 依赖，签名不得改动）

SQL（migration `0016`，`user_version` 15 → 16）：

```sql
CREATE TABLE panorama_placements (
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('macro','phrase','alignment_phrase','modifier','composition')),
  asset_id   TEXT NOT NULL,
  group_id   TEXT CHECK (group_id IN ('align','diverge','converge','execute','polish','retain','cue','tool')),
  pin_slot   INTEGER CHECK (pin_slot BETWEEN 1 AND 9),
  PRIMARY KEY (asset_kind, asset_id)
);
CREATE UNIQUE INDEX idx_panorama_pin_slot ON panorama_placements(pin_slot) WHERE pin_slot IS NOT NULL;
```

TypeScript（`src/ipc/types.ts`）：

```ts
export type PanoramaAssetKind = "macro" | "phrase" | "alignment_phrase" | "modifier" | "composition";
export type PanoramaGroupId = "align" | "diverge" | "converge" | "execute" | "polish" | "retain" | "cue" | "tool";
export interface PanoramaPlacement {
  assetKind: PanoramaAssetKind;
  assetId: string;
  groupId: PanoramaGroupId | null; // null = 用默认规则
  pinSlot: number | null;          // 1..9
}
```

IPC（`src/ipc/index.ts`，对应 Rust 命令 `list_panorama_placements`、`set_panorama_placement`）：

```ts
listPanoramaPlacements(): Promise<PanoramaPlacement[]>
setPanoramaPlacement(input: PanoramaPlacement): Promise<PanoramaPlacement[]> // 返回写入后的完整列表
```

## 行为

- `set_panorama_placement` 是 upsert。`groupId` 与 `pinSlot` 都为 `null` 时删除该行。
- 把 `pinSlot` 设为已被占用的位置时，在同一事务里先清空原占用者的 `pin_slot`，再写入。不报错。
- `list_panorama_placements` 只返回其资产仍存活（未软删除）的行。查询若 JOIN 资产表，必须带 `deleted_at IS NULL`，否则会被第七道闸门拦下。
- 导出：`ExportBundle` 增加 `panorama_placements: Option<Vec<PanoramaPlacement>>`，`DATA_SCHEMA_VERSION` 升到 `"1.5"`。
- 导入三态，沿用 `website_library` 的口径：缺该键（1.4 及更早的文件）= 保留库里现有布局中仍能对上资产的行；空数组 = 清空；有内容 = 整表替换。引用不存在资产的行丢弃，不报错。

## 不做

- 不新增 `usage_records.source` 取值，不动 `usage_records` 表。
- 不做前端界面与 store（归 I-03）。
- 不写任何种子布局数据。

## 完成定义

- 迁移在 v15 库上跑通，`user_version` = 16；`foreign_key_check` 为空。
- Rust 测试覆盖：upsert、抢占常用位、双 null 删除、软删除资产的行不返回、导出导入 1.5 往返、导入 1.4 文件不报错且保留现有布局、导入时丢弃悬空行。测试名含 `panorama`。
- `EXPECTED_COMMAND_COUNT` 改为 73，注释写明 71 → 73 的原因。
- `cargo clippy --workspace --all-targets --manifest-path src-tauri/Cargo.toml -- -D warnings` 与 `cargo fmt --manifest-path src-tauri/Cargo.toml --check` 通过。
- 回退方案写进 PR 描述：迁移只新增一张表，回退 = 旧二进制忽略该表；但 `user_version` 16 的库不能交给 15 的二进制，发版号必须高于当前公开版本。
