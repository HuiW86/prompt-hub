// Screenshot harness only — NOT shipped. Stands in for the Tauri bridge so the
// real React app renders in a plain browser with a deterministic library.
(function () {
  const now = Date.now();
  const daysAgo = (d) => new Date(now - d * 86400000).toISOString();
  const long =
    "你是一名资深的软件架构师。请先通读我给出的需求文档和现有代码结构，然后按以下步骤工作：\n\n" +
    "1. 用三句话复述你理解的目标、约束和非目标（Non-goals），如果有任何歧义，先列出问题再继续。\n" +
    "2. 给出 2–3 个候选方案，每个方案说明 trade-off：复杂度、性能（P95 latency）、可维护性、迁移成本。\n" +
    "3. 推荐一个方案，并说明 why not 其它方案；引用具体文件路径，例如 src/stores/settingsStore.ts。\n" +
    "4. 输出实施计划：按 PR 粒度拆分，每个 PR 包含 scope、验收标准（acceptance criteria）和回滚方式。\n\n" +
    "约束：不要引入新的第三方依赖；所有 CSS 必须使用 design tokens；保持 hotkey wake ≤ 200ms P95。" +
    "如果信息不足，请明确说 I don't know，而不是猜测。最后用一个 Markdown 表格总结风险 (risk) 与缓解措施 (mitigation)。\n\n" +
    "附加说明：这段提示词刻意写得很长，用来检验全文预览能否完整阅读——包括换行、列表、English words mixed with 中文、" +
    "以及一个很长的不可断开的 URL：https://github.com/HuiW86/prompt-hub/blob/main/docs/design/05-design-spec.md#section-10-2-2-typography-scale-and-readability-contract 。" +
    "\n\n第二部分：请再检查一遍边界情况——空列表、超长名称、网络失败、并发写入、时区切换（UTC vs Asia/Shanghai），以及 macOS 与 Windows 的快捷键差异（⌘ vs Ctrl）。" +
    "每一项都要给出复现步骤和预期结果。全部完成后，用不超过 200 字给出一句话结论。";
  const medium =
    "请用第一性原理拆解这个问题：先列出不可再分的事实，再从事实推导结论，最后指出哪一步最可能出错。Keep it concise.";

  const phaseIds = [
    "understand", "diverge", "converge", "plan", "generate", "execute", "iterate", "distill", "live",
  ];
  const phaseNames = ["理解", "发散", "收敛", "规划", "生成", "执行", "迭代", "沉淀", "中途"];
  const phases = phaseIds.map((p, i) => ({
    id: "phase-" + p,
    name: phaseNames[i],
    orderIndex: i,
    color: null,
    description: null,
    visible: true,
    defaultAlignmentPhraseId: null,
  }));

  let seq = 0;
  const ap = (phase, name, content, used, lastDays, extra) => ({
    id: "ap-" + ++seq,
    phaseId: "phase-" + phase,
    name,
    content,
    isDefault: false,
    usageCount: used,
    lastUsedAt: lastDays == null ? null : daysAgo(lastDays),
    createdAt: daysAgo(extra && extra.newish ? 3 : 200),
    notes: null,
    deprecated: false,
    orderIndex: seq,
    kind: phase === "live" ? "cue" : "opening",
    layerId: null,
    domainId: null,
    modeId: null,
    cueAxis: null,
    contentRevisedAt: null,
  });
  const alignment = [
    ap("understand", "需求澄清：先复述再动手", long, 42, 1),
    ap("understand", "第一性原理拆解", medium, 18, 5),
    ap("understand", "读代码前先画调用链 call graph", medium, 7, 20),
    ap("understand", "旧的需求访谈模板（很久没用）", medium, 2, 200),
    ap("diverge", "列出 5 个完全不同的方案", medium, 25, 2),
    ap("diverge", "反向思考：如何让它彻底失败", long, 9, 30),
    ap("diverge", "Brainstorm wild ideas without judging", medium, 1, 150),
    ap("converge", "方案对比表 trade-off matrix", long, 31, 1),
    ap("converge", "砍需求：只留最值得做的一件", medium, 12, 10),
    ap("plan", "按 PR 粒度拆分实施计划", long, 37, 0),
    ap("plan", "风险清单与回滚方案", medium, 8, 40),
    ap("plan", "里程碑 Milestone 拆解", medium, 0, null, { newish: true }),
    ap("generate", "严格按设计规范写组件", long, 22, 3),
    ap("generate", "先写测试再写实现 TDD", medium, 14, 12),
    ap("execute", "一次只改一件事", medium, 19, 4),
    ap("execute", "修 bug 先复现再修", long, 11, 8),
    ap("iterate", "对抗式审查：找出 3 个最可能的缺陷", long, 16, 6),
    ap("iterate", "性能回归检查 P95", medium, 3, 100),
    ap("distill", "沉淀为 ADR：决策、理由、代价", long, 10, 15),
    ap("distill", "写 HANDOFF 断点", medium, 6, 25),
    ap("distill", "Retro: what went well / badly", medium, 1, 300),
    ap("live", "停", "停。先别写代码，说说你现在在做什么、为什么。", 30, 0),
    ap("live", "回到目标", "回到最初的目标，刚才的改动是否偏离？", 12, 2),
    ap("live", "缩小范围", "范围太大了，只做最小可验证的一步。", 5, 9),
  ];
  // A deliberately very long name to check row truncation.
  alignment[2].name = "读代码前先画调用链 call graph，并标出所有跨模块的副作用与外部依赖";

  const macros = [
    { id: "m-1", name: "代码审查 Code Review", content: long },
    { id: "m-2", name: "写提交信息", content: medium },
    { id: "m-3", name: "解释这段报错", content: medium },
  ].map((m, i) => ({
    ...m,
    expandFrom: null,
    native: false,
    role: null,
    task: null,
    usageCount: [55, 20, 4][i],
    lastUsedAt: daysAgo([0, 3, 60][i]),
    createdAt: daysAgo(200),
    notes: null,
    sceneId: null,
    deprecated: false,
    orderIndex: i,
  }));

  const placements = [
    { assetKind: "alignment_phrase", assetId: "ap-1", groupId: null, pinSlot: 1 },
    { assetKind: "alignment_phrase", assetId: "ap-10", groupId: null, pinSlot: 2 },
    { assetKind: "macro", assetId: "m-1", groupId: "iterate", pinSlot: 3 },
    { assetKind: "macro", assetId: "m-2", groupId: "distill", pinSlot: null },
    { assetKind: "macro", assetId: "m-3", groupId: "tool", pinSlot: null },
    { assetKind: "alignment_phrase", assetId: "ap-8", groupId: null, pinSlot: 4 },
  ];

  const results = {
    list_phases: phases,
    list_alignment_phrases: alignment,
    list_alignment_axis_values: [],
    list_compositions: [],
    list_macros: macros,
    list_modifiers: [],
    list_scenes_with_children: [],
    list_recent_usage: [],
    count_today_usage: 7,
    list_drafts: [],
    count_pending_drafts: 0,
    get_global_hotkey: "Alt+Space",
    hotkey_registered: true,
    list_websites: { groups: [], websites: [] },
    list_panorama_placements: placements,
    set_panorama_placement: placements,
    list_trash: [],
    summarize_drift_ledger: { anchors: [], liveCueTotal: 0, unattributed: 0 },
    record_usage: {
      id: "u",
      timestamp: new Date().toISOString(),
      targetType: "alignment",
      targetId: null,
      source: "phase_bar",
      modifierIds: null,
      sopId: null,
      sopStepOrder: null,
      phaseId: null,
      sessionStartedAt: null,
    },
  };

  let cb = 0;
  window.__SHOT_CALLS__ = [];
  window.__TAURI_INTERNALS__ = {
    metadata: {
      currentWindow: { label: "main" },
      currentWebview: { windowLabel: "main", label: "main" },
    },
    transformCallback: () => ++cb,
    unregisterCallback: () => {},
    convertFileSrc: (p) => p,
    invoke: async (cmd) => {
      window.__SHOT_CALLS__.push(cmd);
      if (cmd in results) return JSON.parse(JSON.stringify(results[cmd]));
      if (cmd.startsWith("plugin:event")) return cb;
      if (cmd.startsWith("plugin:updater")) return null;
      return null;
    },
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
  // Clipboard writes need a user-activation in some engines; keep them silent.
  try {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async () => {} },
      configurable: true,
    });
  } catch (e) {}
})();
