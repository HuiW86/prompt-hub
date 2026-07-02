# Handoff — 改进计划批量落地（P0 快修 ×6 + P2 护栏 ×3 + P3 UI 提升 ×7）+ 文档涟漪收口
<!-- Updated by 文档-core agent at 2026-07-01 -->

## Objective
多 agent 并行执行 prompt-hub 改进计划：P0 快修 6 项、P2 工程护栏 3 项、P3 UI/资产生命周期提升 7 项，随后文档涟漪收口（CLAUDE.md §7 / README / ADR-019 / MANIFEST / 本文件）。**全部改动已落地但尚未 commit**。

## Completed（本轮交付清单）

### P0 快修（6 项）
1. **P0-1** primary 按钮对比度：`.btnPrimary` 文字色 `var(--layer)` → `var(--fg-1)`；token-gate 新增「禁 var(--layer) 作文字色」规则
2. **P0-2** 复制失败可见：useCopy try/catch + toast intent 分级（success 800ms / error 4000ms amber + role=alert）
3. **P0-3** AlignmentPhrases region 补 `:focus-visible` 焦点框（与其他 3 region 同口径）
4. **P0-4** 更新失败降级：auto 检查失败静默（console.warn + idle）/ manual 保留全量反馈；Dashboard 加载失败加「重试」；UpdaterBanner 按钮补焦点态
5. **P0-5** Composition 禁 promote 止血：DraftInbox 归档按钮 disabled + 「该类型暂无 UI 承载」提示（discard 可用；解锁条件 = Composition 获得查看/搜索/删除 UI 承载）
6. **P0-6** 启动 panic 兜底：DB 打开/迁移失败 → 阻断式错误对话框 + `app.exit(1)`（in-memory 连接兜底防 IPC panic）；`bench:hotkey-wake` P95 超 200ms 退出码 1（可作 CI C1 gate）

### P2 工程护栏（3 项）
1. **P2-1** 测试 CI：新建 `.github/workflows/ci.yml`（push main + PR，frontend/rust 双 job，action 全 pin SHA）
2. **P2-2** B2 源码级 gate 恢复：`src/components/__tests__/b2-separation.test.ts`（5 用例，取代已删 composition-b2-separation.test.ts）
3. **P2-3** IPC 三方契约 gate：`src/ipc/ipc-contract.test.ts`（commands.rs ↔ generate_handler ↔ ipc/index.ts，46 命令双向等价）

### P3 UI/资产提升（7 项）
1. **P3-1** Scene 全景 auto-fit 列宽（`--col-min-substage`）+ 「未分组」muted 列头
2. **P3-2** Draft 促升前编辑：新增第 6 个 draft IPC `get_draft` 水合全量 payload，编辑器复用 primitives（composition 编辑同样禁用）
3. **P3-3** light 主题明度重绘（canvas muted 灰 / surface-1 纯白）+ 4 个抬升容器 resting `--shadow-1`
4. **P3-4** 协议层暗 band 恢复：`--band-*` 层级固定色 token 族 + band 作用域中性 token 重映射 + 层级编码修缮 → **ADR-020 Accepted**
5. **P3-5** 设计稿像素对齐包：Macro 图标盒 accent 全量填充（hot=Flame 实心）+ `--lift-1` hover 抬起 + 富空态（EmptyState 扩插槽 + Button intent=accent）
6. **P3-6** 资产生命周期补救：Modifier 移象限/删除（update_modifier 扩 groupKind）+ `set_default_alignment_phrase` 新命令 + Scene（前移/后移按钮）/SubStage（dnd）排序 UI
7. **P3-7** `.ph-*` typography preset 落地（`src/styles/typography.module.css`，7 preset + composes 迁移）+ focus offset 离群收敛 + Chip max-width token

### 文档涟漪（本 agent）
- `CLAUDE.md` v1.0 → **v1.1**：§7 除锈（真实版本号 product-spec v0.12 / design-spec v0.12 / features v1.7 / MANIFEST v1.8；Tab cycle 现行 6 区备注；B2 gate 取代备注）+ 补 ADR-019/020 与本轮改进条目 + 下一动作更新；§2 bench 补 C1 gate 退出码说明
- `docs/design/README.md`：pre-code 0 LOC → 实施中 / pnpm 9.x → 10.x / ADR-001~010 → 001~020 / CLAUDE-DESIGN v0.1 → v0.2 待重传
- `docs/adr/019-*.md`：frontmatter status Proposed → **Accepted**（正文 §2 早已 Accepted 2026-06-26，机械同步）
- `docs/MANIFEST.md` v1.7 → **v1.8**：+ADR-020 行（19 份）+ 新 §11.6 工程护栏（ci.yml/release.yml/3 个 gate 测试）+ product-spec/features/CLAUDE.md 版本除锈

## Verify（本轮验证基线）
- `pnpm test` → **151/151**（16 文件，含 token-gate / b2-separation / ipc-contract 三 gate）
- `pnpm lint` / `pnpm exec prettier --check .` / `pnpm build` → 全绿
- `cargo test --workspace --manifest-path src-tauri/Cargo.toml` / clippy `-D warnings` / fmt → 全绿

## Next Actions
1. **git 工作区未提交**：本轮全部改动（46 modified + 8 untracked，含本文件等 5 份文档）待 commit——注意前序会话结论「主 shell git 写不持久化」，如 bash 仍未修好走隔离 Workflow 通道提交
2. **真机复验**：P3 视觉项（暗 band / light 重绘 / 像素对齐包）均为推断+测试验证，未真机截图复核；P0-6 错误对话框、P3-2/P3-6 的 DB 落盘核对同待真机
3. **`bench:hotkey-wake` 复测守 C1**：本轮 UI 改动后回归（P95 基线 12.9-13.5ms；超 200ms 现在会退出码 1）
4. **ADR-017 Phase 6 真机验收**：updater opt-in / 检查链路（承接前序 HANDOFF）
5. **CLAUDE-DESIGN v0.2 重传**：omar 重新上传 Claude Design 替换旧 design system（ADR-019 涟漪，外部依赖）
6. **v0.1.0 发布**（承接前序 HANDOFF）：`git push origin main` → `git tag v0.1.0 && git push origin v0.1.0` 触发 release.yml；两道手动关卡（release-signing Environment 审批 + draft release 人工核验后 Publish）
7. **主 shell bash 故障**（承接前序 HANDOFF）：`USE_BUILTIN_RIPGREP=0` 缓解无效，升级 Claude Code 根治；修复前 git 写操作走隔离 Workflow

## Risks & Decisions
- 全部改动未提交——commit 前工作区是唯一副本，勿 `git reset --hard`
- P0-5 Composition promote 止血是临时闸：单点常量 `PROMOTE_BLOCKED_HINT`，解锁只需删一行
- P3-4 band token 为「双主题同值」设计（mode-invariant by design）；band 内未来引用未重映射 token（--skeleton/--shadow-*）需补映射（见 ADR-020）
- P3-7 遗留：mono 计数惯例与 design-spec §9 .ph-meta(sans) 系统性分叉，待 spec 收编或明确豁免；ph-code preset 暂无消费者
- 其余文档涟漪（design-spec/product-spec/prd/features/test-spec/ops-spec 的逐条回写，见各 agent notes）属后续 doc-ripple 任务，本轮只收口 CLAUDE.md/README/ADR-019/MANIFEST/HANDOFF 五份

## Modified Files（文档收口部分）
- `CLAUDE.md`（v1.1）
- `docs/design/README.md`
- `docs/adr/019-supersede-flat-visual-anchor.md`（status Accepted）
- `docs/MANIFEST.md`（v1.8）
- `HANDOFF.md`（本文件）

代码改动清单见各执行 agent 报告（P0 ×6 / P2 ×3 / P3 ×7），`git status` 可核对全量。
