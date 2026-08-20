---
type: adr
project: prompt-hub
status: Accepted
description: 全局唤起键可配置——兑现 product-spec §13.4 自 v0.5 起写下却从未实现的「默认值，可配置」；绑定存 SQLite（setup 阶段唯一读得到的持久层），冲突只能靠 register() 失败探知，并新增 macOS Reopen 逃生口防止用户把自己锁在门外
related:
  - 03-product-spec
  - 06-prd
  - 008-enable-macos-private-api
  - 003-choose-data-persistence
  - 02-constitution
---

# ADR-027: 全局唤起键可配置（绑定入库 + 运行时重注册 + Reopen 逃生口）

## 1. 标题与日期

- **标题**：全局唤起键从硬编码 `⌥Space` 改为用户可配置——绑定持久化到 SQLite，改键走可运行时重注册的 IPC，并新增一条不依赖快捷键的唤起通路
- **日期**：2026-08-20
- **决策者**：omar（2026-08-20 拍板）；起草：Claude（🤝 共创文档，见 [[CLAUDE#§5.2]]）
- **影响范围**：
  - **代码**：`src-tauri/src/lib.rs`（setup 读绑定 + 注册 + `RunEvent::Reopen` 分支）/ `src-tauri/src/commands.rs`（新增 `get_global_hotkey` / `set_global_hotkey`）/ `src-tauri/crates/repo-core`（新增 `settings` KV 表，migration `0012`，`user_version` 11→12）/ `src/stores/settingsStore.ts`（`globalHotkey` 由死字段转为真绑定）/ `src/components/SettingsModal.tsx`（录键控件）/ `src/components/HotkeyBanner.tsx`（文案不再写死 `⌥Space`）
  - **文档**：[[03-product-spec]] §13.4「可配置」条目落地 + §1.1 触发描述 + §13.4 键位表；[[06-prd]] §5.8 可配置项清单（**现缺此项**）+ §6 数据模型（`settings` 表）；[[09-tech-stack]] 无变更（不新增依赖）
  - **ADR**：不推翻 [[008-enable-macos-private-api]]（NSPanel 唤起模型不动，只换触发它的键）；沿用 [[003-choose-data-persistence]] 的 SQLite 单库

## 2. Status

`Accepted`（2026-08-20 起草并由 omar 当日拍板，三条子决策全数通过）

> **范围声明**：本 ADR 只裁**全局唤起键**一条。结构导航键（Tab / 方向键）与动作键（区域内裸字母键）的可配置性**显式不裁**，理由见 §5「显式不裁」。
>
> **落地进度（2026-08-20 当日实施）**：代码全部落地。migration `0012_settings`（`user_version` 11→12）、`repo-core/src/settings.rs`、`get_global_hotkey` / `set_global_hotkey` 两个 IPC（51→53）、`SettingsModal` 录键控件、`RunEvent::Reopen` 分支均已实现，前端 373→**395** / Rust 158→**168** 全绿（此处一度写成 388/170——那是起草时的**估数**，实测后订正；估数混进"落地进度"与本 ADR §3 批判的账实不符是同一类错误）。
>
> **实施期口径修订 1 — 缺行回落默认值，不再 `fail_startup`**：子决策 1 原文写「读取路径无 `None` 分支，读不到 = 库损坏，走 `fail_startup`」。实施时改为**缺行回落 `Alt+Space` 并照常启动**。理由是原方案与子决策 3 的第三层逃生口自相矛盾：那条逃生口正是「用 `sqlite3` 手改 `settings` 表救回来」，而手改时打成 `DELETE` 而非 `UPDATE` 就会让应用**永久开不了机**——把逃生口变成砖头。缺行是可恢复状态，不该与"库损坏"同等对待。
>
> **实施期口径修订 2 — `set_global_hotkey` 必须是 `async` 命令**：插件的 `register()` / `unregister()` 内部用 `run_main_thread!` 派发并**阻塞等待结果**（`tauri-plugin-global-shortcut-2.3.1/src/lib.rs:73-85`），而同步 IPC 命令本身就跑在主线程上（`commands.rs:201-205` 既有注释已述该事实）。同步命令里调用即**主线程自锁死**。改 `async fn` 让 Tauri 把它派到 async runtime，是唯一不改插件的解法。这条不影响任何契约，属实现约束，记此备忘以防后人"顺手改回同步"。
>
> **真机验收门 G3（2026-08-20 走查：3 通过 / 1 不可达）**：明细见 [[11-test-spec#4.2]]。项 1（改绑后新键生效、旧键失效）、项 3（Dock reopen 逃生口，两次复现，**顺带证实「点 Dock 图标无反应」已修**）、项 4（重启后绑定读自 SQLite 仍生效）**全部通过**。
>
> **omar 当日另行真机走查（自有数据库、`⌥ Space` 默认绑定），未发现问题** —— 人工目视，不可回归，覆盖范围未逐条记录；与上面 AI 侧的 G3 取证互补而非替代。
>
> ⚠️ **项 2 不可达，且这暴露了子决策 2 的一个认知缺口**：门项设想「按下已被占用的组合键 → 报已被占用」，但真机上**按不出来**——被占用的组合键由持有方在 OS 层注册并消费，本应用的 webview 收不到该按键。实测以第二个实例占住 `⌥Space`，在第一个实例录键态按 `⌥Space`，结果是**第二个实例的窗口弹出**，录键器全程无输入。
>
> 因此本 ADR §5 子决策 2 的「冲突只有 `register()` 失败一种形态」**对探测是对的，对用户体验是不完整的**：`HotkeyUnavailable` 仍必要（竞态、系统保留但非 Carbon 持有的组合键会走到它），但冲突的**主要形态**是「按下去本窗口没反应、另一个应用跳出来」，界面不给任何解释。这是新问题，**不在本 ADR 已批范围内**，已挂 [[HANDOFF]] 待裁。

## 3. Context

### 触发事件

2026-08-20 的 [[025-unified-anchored-editing]] 契约回流中，逐条比对 product-spec 与代码时发现：`docs/design/03-product-spec.md:861` §13.4 键位表写着

> \| `⌥ Space` \| 全局唤起仪表盘 \| **默认值，可配置** \|

`:46` §1.1 亦写「全局快捷键（默认 `⌥ Space`，可配置）」。而实现是 `src-tauri/src/lib.rs:165` 的

```rust
let toggle = Shortcut::new(Some(Modifiers::ALT), Code::Space);
```

**一个字面量，没有任何读取用户配置的路径。** 该条文自 product-spec v0.5 起在册，已挂账约三个月。回流当时已在 `03-product-spec.md:924` 就地标注为遗留欠账并指向本 ADR。

这不是新需求，是**旧承诺**——这个区别决定了本 ADR 的举证责任：不需要论证"用户是否需要改键"，只需要论证"怎么实现最省"。

### 事实一：「可见化」那一半早已完成，不要重复立项

起草前的一处判断错误已更正：`HotkeyBanner.tsx` 早已存在——查 `AppState.hotkey_registered`，注册失败时出一条可关闭的中文告警横幅（`src-tauri/src/commands.rs:59-64` 记录该标志，`lib.rs:221-226` 在 `register()` 失败时置 false 并继续启动而非 panic）。

**所以本 ADR 的增量只有"可改"，不含"可见"。** 需要动 `HotkeyBanner` 的地方只有一处：文案里写死的 `⌥Space` 要换成当前绑定。

### 事实二：settingsStore 里已有一个死字段

`src/stores/settingsStore.ts:64` 声明 `globalHotkey: "Alt+Space"`，`:77` 有 `setGlobalHotkey`，`:121` 的注释自陈「globalHotkey + hiddenPhaseIds stay in-memory MVP state」——**它不在 `partialize` 白名单里（`:123-128`），不持久化；全仓 grep 除自身与两条测试外零消费者**。`src/stores/__tests__/settingsStore.test.ts:12-18` 两条测试正在钉住一个没有任何读者的字段。

有价值的副产品：默认值字符串 `"Alt+Space"` 恰好就是 `tauri-plugin-global-shortcut` 的 accelerator 解析格式，**格式选型无需重新拍板**。

### 事实三：HANDOFF 记的「破 settingsStore 的界」经核实不成立

上一轮 HANDOFF 记「SQLite 方案的代价是破 `settingsStore.ts:18` 注释『appearance prefs 永不进 SQLite』的界」。回读原文：

> Appearance prefs persist to localStorage only (never SQLite, never uploaded — constitution A2).

该约束**主语是 appearance prefs**（theme / accent / density / interactionMode）。全局唤起键不是外观偏好，是运行时行为绑定。**边界从一开始就没盖住它，无界可破。** 唯一需要新写的是一条说明：为什么同一个 store 里的字段有两种持久化归属。

### 技术约束（决定选项空间的三条）

1. **注册发生在 setup，早于任何前端代码**。`lib.rs:101` 的 `setup()` 里，`register()` 在 `:221`；webview 挂载、localStorage 可读都在之后。**Rust 在需要绑定的那一刻读不到 localStorage。**
2. **`open_and_migrate` 在 `:113`，早于 `:221`**。数据库连接在快捷键注册之前就已就绪——这是 SQLite 方案不需要任何时序改造的原因。
3. **macOS 没有 API 枚举"某组合键已被谁占用"**。Carbon `RegisterEventHotKey` / `CGEventTap` 都只回答"我能不能拿到"，不回答"谁拿着"。**冲突探测只有一种形态：试着注册，失败即冲突。**

### 业务约束

- [[02-constitution#C1]] 200ms 唤起：绑定读取发生在 **startup**，不在 wake 热路径。`register()` 之后运行时行为与今日逐字节相同，C1 预算零影响
- [[02-constitution#A2]] 数据不出机器：`settings` 表是本地 SQLite，不上传；且**不应进入 `export_data`**（见子决策 1 附注）
- [[01-spec]] 哲学九「界面自身是被维护的资产」：[[06-prd#5.8]] 的可配置项清单**恰恰漏了唤起键**——这是清单本身的缺口，不是本决策新增的诉求

### 不决策的代价

- 契约与实现的偏差继续挂账。这是 2026-08-20 回流查出的**三处账实不符之一**，另两处已当场处置，只剩这处需要真实工作量
- 用户机器上一旦 `⌥Space` 被占（Spotlight 重映射、输入法切换器、Alfred/Raycast 是常见占用者），**产品的主形态就彻底不可达**——目前的补偿只是一条横幅告诉用户"去关掉那个应用"，把冲突解决责任推给用户
- `settingsStore.globalHotkey` 这个死字段与它的两条测试会继续伪装成"已实现"

## 4. Options Considered

> 四个选项差异的实质是**绑定存在哪**（前三个）与**要不要做**（第四个）。三条子决策中的 ②③ 在任一存储方案下都相同，故不构成选项维度。

### Option A: localStorage（前端单一持久层）

- **描述**：把 `globalHotkey` 加进 `partialize` 白名单，前端挂载后通过 IPC 把绑定推给 Rust，Rust 先用默认键注册、收到推送后再重注册。
- **优点**：零 schema 变更；所有设置留在一处，`SettingsModal` 的读写模式与 theme/accent/density 完全一致；无需新 migration，回退即删白名单一行。
- **缺点**：**存在一个必然的错误注册窗口**——开机先注册旧键（默认 `⌥Space`），前端挂载后再改。而用户改键的原因**通常正是 `⌥Space` 冲突**，于是每次启动都要先失败注册一次、可能短暂抢占别人的键，再切到正确的键。这个窗口无法通过工程手段消除，它是"配置的读者早于配置的存储介质"这一结构决定的。
- **预估成本**：约 0.5 天，交付一个每次启动都要经历一次错误状态的实现。

### Option B: SQLite `settings` KV 表（选定）

- **描述**：新增 migration `0012_settings`，建 `settings(key TEXT PRIMARY KEY, value TEXT NOT NULL)`。setup 在 `open_and_migrate` 之后、`register()` 之前读一行；前端改键走新 IPC，由 Rust 同时完成"落库 + 重注册"。
- **优点**：**注册时刻就能拿到正确的绑定，无错误窗口**；时序上零改造（`:113` 本就在 `:221` 之前）；写入与重注册在同一个 IPC 内原子发生，不存在"库里存了新键但没注册成功"的分裂状态；`settings` 表可复用于后续任何"Rust 启动期需要的配置"（`activationPolicy`、启动即唤起等）。
- **缺点**：引入第 12 号 migration，`user_version` 11→12——schema 一旦发布不可回退（下游 MCP 进程共享同库）；设置项从此有两个持久化归属（外观在 localStorage、行为在 SQLite），需要一条明确规则否则后人会随机挑一个；新增两个 IPC 命令（51→53）。
- **预估成本**：约 1.5 天（migration + repo 层 + 2 个 IPC + 录键控件 + Reopen 分支 + 测试）。

### Option C: `app_data_dir` 下的 JSON 配置文件

- **描述**：不进库，写一个 `config.json`（自建 serde_json 或 `tauri-plugin-store`）。Rust 在 setup 直读文件。
- **优点**：同样无错误窗口；不动 schema，无 migration 与 `user_version` 风险；文件可手工编辑——顺带提供了一条"改坏了用文本编辑器救回来"的逃生口。
- **缺点**：**引入第三套持久化机制**（SQLite + localStorage + JSON 文件），而项目只有一个用户、一台机器，这个复杂度换不来对应收益；自建即要自己处理原子写、损坏回落、版本迁移——这些 SQLite migration 框架已经有了；`tauri-plugin-store` 则是新依赖，按 [[CLAUDE#§6]] 第 7 条要走 tech-stack 流程；备份/导出路径要多覆盖一个文件（`repo-core/src/backup.rs` 现只管 DB）。
- **预估成本**：约 1.5 天，与 B 持平但多留一套机制。

### Option D: 不做——改判契约，删掉「可配置」三个字

- **描述**：承认单用户单机场景下改键需求弱，把 product-spec §13.4 与 §1.1 的「可配置」删除，`HotkeyBanner` 文案改为明确的"请让出该组合键"，同时删掉 settingsStore 的死字段与两条测试。
- **优点**：0.5 天完成，账实归一；不增 schema、不增 IPC、不增 UI 面积；符合「优先最简方案」。
- **缺点**：**它把风险留在唯一不可降级的路径上**——唤起键是主形态的唯一入口（辅形态另计），冲突时产品不可达，而冲突方可能是用户更不愿让步的工具（输入法、Spotlight）；[[06-prd#5.8]] 的哲学九立场（界面自身可维护）与"唯独入口不可改"直接抵触；改判契约需要人主笔文档改口，成本不比实现低多少。
- **预估成本**：0.5 天，交付一个把已知单点故障固化下来的结果。

## 5. Decision

> **一句话拍板**：选 Option B —— 绑定存 SQLite 是唯一能让"注册那一刻就拿到正确的键"的方案，而错误注册窗口恰好发生在最需要它正确的场景（用户因冲突才改键）。

**为什么不选其他**：

- 不选 A 因为：它把一个**结构性**的错误窗口留在唯一入口上，且该窗口在改键者身上必然触发，不是边缘情况
- 不选 C 因为：为一个 KV 值引入第三套持久化机制，自建原子写与损坏回落，去重造 migration 框架已提供的能力
- 不选 D 因为：它以"需求弱"为由，把单点故障从"可缓解"降级为"设计如此"

### 子决策 1 — 绑定存 SQLite `settings` KV 表，**不是**存进外观设置

新增 `0012_settings.sql`（`user_version` → 12）：

```sql
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

首行 `('global_hotkey', 'Alt+Space')` 由 migration 直接 seed，因此**读取路径无 `None` 分支**（读不到 = 库损坏，走既有 `fail_startup` 对话框，不新增失败形态）。

**两套持久化的归属规则**（写进 `settingsStore.ts:18` 注释块，避免后人随机挑）：

| 归属 | 判据 | 现有成员 |
|---|---|---|
| localStorage | **只有渲染进程需要**、丢失无感、纯偏好 | theme / accent / density / interactionMode / 布局分栏值 |
| SQLite `settings` | **Rust 在前端挂载之前就需要读** | `global_hotkey` |

判据是"谁在什么时候需要读"，不是"重不重要"——这条规则可机械执行，无需再讨论。

> **附注 · 不进导出**：`settings` 是机器本地配置，**不应加入 `export_data` / `import_data`**（`commands.rs:283-284`）——把 A 机器的键绑定导入 B 机器只会带来冲突。导出的定位是资产可带走（[[06-prd#5.8]] 抗工具锁定），配置不是资产。这一条须在实现时显式写进 `export.rs` 的注释，否则半年后会被当成遗漏"补上"。

`settingsStore.globalHotkey` 从死字段转为真绑定：值来自 `get_global_hotkey` IPC（不再来自 persist），`setGlobalHotkey` 改为调用 `set_global_hotkey` 后回写。`settingsStore.test.ts:12-18` 两条测试须重写为"从 IPC 读取 / 写入失败时不改本地态"，否则它们继续在验证一个不存在的机制。

### 子决策 2 — 冲突探测只有 `register()` 失败一种形态，改键走可回滚的运行时重注册

macOS 无枚举 API（§3 技术约束 3），故不做"检测占用者是谁"的努力。新增：

```
set_global_hotkey(accel: String) -> Result<(), Error>
  1. 解析 + 校验 accel（失败 → InvalidAccelerator，不落库）
  2. unregister(旧绑定)
  3. register(新绑定) — 失败 → 立即 register(旧绑定) 回滚，返回 HotkeyUnavailable
  4. 落库 settings.global_hotkey
  5. 更新 AppState.hotkey_registered
```

**顺序是决策而非实现细节**：先注册成功再落库，保证"库里的值永远是当前真正生效的值"。反过来会产生"设置面板显示新键、实际唤起用旧键"的分裂。

**校验规则（硬约束）**：

- **至少一个修饰键**——无修饰的全局键会吞掉所有应用的该按键，这是不可恢复的用户体验事故，拒绝而非警告
- 单个主键 + 任意修饰组合；解析交给 `Shortcut::from_str`，不自建解析器
- 不维护"系统保留键黑名单"：macOS 自己会让 `register()` 失败，黑名单只会与 OS 版本脱节

**录键控件**：`SettingsModal` 新增一行（外观段之外，属"行为"），键盘捕获用 `e.code` 而非 `e.key`——与 [[025-unified-anchored-editing]] P2 键位表同一理由：`e.code` 描述物理位置，跨键盘布局稳定。

### 子决策 3 — 新增 macOS `RunEvent::Reopen` 逃生口

改键引入一个今日不存在的失败模式：**用户把绑定改成一个自己也按不出来的组合，或改成一个开机后才被别人抢走的键，从此无法唤起窗口**。横幅救不了——横幅在窗口里。

已核实 `tauri 2.11.2` 提供 `RunEvent::Reopen { has_visible_windows, .. }`（`app.rs:275-279`，对应 `applicationShouldHandleReopen`），且本应用**未设置 accessory activation policy**（`tauri.conf.json` 无相关配置，`Info.plist` 无 `LSUIElement`）——**Dock 图标存在**。在 `lib.rs:289` 的 `app.run` 闭包中加一个分支即可：

```
RunEvent::Reopen { .. } => 走与快捷键处理器相同的 wake（run_on_main_thread + fit + show + macos::wake）
```

**顺带修掉一个既有缺陷**：窗口 `visible: false`，今日点 Dock 图标**毫无反应**——这是 bug，不是逃生口设计的副产品。重复启动 `.app`（Finder / Spotlight）同样触发 reopen，故逃生口有两条通路。

**为什么不选另两个**：

- **(a) 保留不可改的兜底和弦**：它自己也可能被占用，且是永久硬编码——等于把本 ADR 要解决的问题原样搬到第二个键上，还多一个"用户不知道它存在"的隐藏契约
- **(c) `--show` 命令行参数**：可行但需要用户开终端并知道 `.app` 内可执行文件路径；且 Reopen 方案顺带修 bug，它不顺带

**兜底之外的兜底**：若 `Reopen` 也失效，`settings` 表在 SQLite 里，`sqlite3` 一条 UPDATE 可改回——这是 Option B 相对 localStorage 的一个未列入优点（localStorage 在 WebKit 私有存储目录里，用户无从下手）。

### 显式不裁（防止范围蔓延）

1. **结构导航键不可配**（Tab / 方向键 / 区域跳转）：属平台约定，可配置只会破坏跨应用一致性。
2. **动作键不可配**（区域内裸字母键，[[025-unified-anchored-editing]] P2）：动作键是上下文键，冲突面在 app 内部而非系统级；可配反而放大 P2 已挂账的「裸字母键须避让 IME / type-ahead」那笔债。表驱动键位改造同属暂缓。
   > 这两条已在 2026-08-20 会话议定，此处只做转载，**不重新讨论**。三层键性质不同：全局唤起键与整个操作系统争抢，另两层不与任何人争抢——这是唯一一条需要可配置的理由，也只对第一层成立。
3. **多快捷键**（如"唤起并聚焦搜索"另设一键）：不在本 ADR 范围。`settings` 表结构天然支持后续追加行，无需为此预留。

## 6. Consequences

### 正向后果

- product-spec §13.4 / §1.1 挂账约三个月的「可配置」契约兑现，账实归一
- 唯一入口的单点故障从"用户自行让路"降级为"用户改键即可"
- `settingsStore` 的死字段与两条空转测试被清理，不再伪装成已实现
- **顺带修掉"点 Dock 图标无反应"**，且获得一条不依赖任何快捷键的唤起通路
- `settings` 表为后续"Rust 启动期需要读的配置"提供了落点（启动即唤起、activation policy 等），这类需求此前无处安放
- 建立了一条**可机械执行**的持久化归属判据，此后新设置项不需要逐个讨论存哪

### 反向后果

- **schema 前进一格且不可回退**：`user_version` 12 一旦发布，旧版本二进制打开新库会撞 `SchemaVersionMismatch`；MCP 进程共享同库（`repo-core` 是双方共同底座），发版须同批
- 设置的持久化从此**确有两处**。判据虽明确，但"为什么 theme 在这边、hotkey 在那边"永远需要一次解释——已用表格与判据把这次解释固化在代码注释里
- IPC 面 51 → 53
- 录键控件是新的交互面：需要处理"按下即捕获"与"如何取消捕获"，而**捕获态本身会吞掉 ESC** —— 这与 [[025-unified-anchored-editing]] 子决策的 ESC 语义有交叉，实现时须确认不破坏编辑器的 ESC 契约（[[03-product-spec#13.4]]）
- `RunEvent::Reopen` 分支**在 jsdom 与 CI 里均不可验**，只能真机走查（与 ADR-026 的布局项同类）。须进验收门而非测试
- 改键失败的回滚路径（子决策 2 第 3 步）**本身也可能失败**（旧键在这个瞬间被别人抢走）。此时 `hotkey_registered` 置 false、横幅出现、Reopen 仍可唤起——**三层兜底俱在，但这个状态没有测试覆盖**，须显式挂账

### 未来反悔成本

- **代码改造规模**：约 5 个文件、250–300 LOC；回退代码 = revert 单个 commit
- **数据迁移**：**这是本 ADR 唯一的不可逆项**。`settings` 表可以停用但 `user_version` 12 无法退回 11——反悔时的正确做法是留下空表、新开 migration 13 标记废弃，而非降版本
- **学习成本**：无。不新增依赖，不换技术栈
- **不可逆点**：`user_version` 11→12 一经发布即不可逆（发布前可任意改写 `0012_settings.sql`）。**代码、UI、IPC 均可逆。**

## 反模式（写完自检）

- ✅ Options 4 个（含"不做"），D 的优点据实写出未做稻草人
- ✅ Decision 一句话；3 条子决策独立可摘、可单独否决
- ✅ Consequences 含反向后果；不可逆点定位到**唯一一项**（schema 版本），未含糊成"影响较大"
- ⚠️ 起草时**更正了 HANDOFF 自己的两处记载**：「注册失败只在 stderr」（实为已有 `HotkeyBanner`）与「破 settingsStore 的界」（该注释主语是 appearance prefs，不覆盖 hotkey）。**待办清单不是事实源，回 ADR 与代码逐条数**——这正是 2026-08-20 回流沉淀的纪律
- ⚠️ `RunEvent::Reopen` 的可用性、Dock 图标的存在（无 `LSUIElement` / 无 accessory policy）、`db_init` 早于 `register()` 的时序，三项均已逐条核到源码行号，非推测
- ⚠️ 本 ADR **不含**"用户是否需要改键"的论证——因为该问题已由 product-spec v0.5 回答过，本 ADR 只裁实现路径

## 相关链接

- **触发本决策的文档**：[[03-product-spec#13.4]] 键位表（`:861` 自 v0.5 的「可配置」）+ `:924` 遗留标注；2026-08-20 [[025-unified-anchored-editing]] 契约回流的副产品
- **被本决策影响的文档**（回流八步 2026-08-20 当日完成，逐项落点如下）：
  - ✅ [[03-product-spec]] **v0.19 → v0.20** —— §13.3 区域 9 新增「快捷键页」+「设置持久化归属」表；§13.4 `⌥ Space` 行改写 + 新增 `ESC`（录键态）行 + `⌘,` 行页签枚举 3→4
  - ✅ [[06-prd]] **v0.12 → v0.13** —— §5.8 补「全局唤起键」；新增 §6.8-bis Setting
  - ✅ [[07-features]] **v1.14 → v1.15** —— §3.4 新增行 `done`；§4 节奏表合计 87→88；§3.6 全局快捷键注册行补记
  - ✅ [[11-test-spec]] **v0.3 → v0.4** —— 数字全量刷新；新增 §4.2 G3 门四项
  - ✅ [[CHANGELOG]] 2026-08-20 第三段；[[CLAUDE]] §7 指针；[[MANIFEST]] v1.11 → v1.12
  - ❌ **未落 [[06-prd]] §10.3** —— 该节的「6 Tauri IPC」是 MCP 写管线专章的草稿命令面，不是全量命令清单；全量口径归 test-spec §3.3，已刷新至 53
- **相关 ADR**：[[003-choose-data-persistence]]（SQLite 单库，本决策沿用）/ [[008-enable-macos-private-api]]（NSPanel 唤起模型，本决策只换触发键不动模型）/ [[025-unified-anchored-editing]]（P2 键位表与 `e.code` 取向一致；录键态的 ESC 与其编辑器 ESC 契约有交叉面）
