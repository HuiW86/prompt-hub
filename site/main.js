// prompt-hub site — progressive enhancement only. Every section reads fine
// without this file; the script adds the live cockpit, the gear shifter and
// the composer. No network calls, no storage, no third-party code.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ── Content (mirrors the app's seed data, migrations 0002 / 0014) ── */
const PHASES = [
  ["发散", "我们做发散，铺开可能性，先不下结论。"],
  ["理解", "我们先理解，确认上下文与现状再行动。"],
  ["规划", "我们做规划，先定方向、列步骤，再动手。"],
  ["生成", "我们进入生成模式，按方案产出。"],
  ["执行", "我们进入执行模式，按方案干活，不再发散。"],
  ["收敛", "我们收敛，从已有方案中选出最优解。"],
  ["沉淀", "我们沉淀，把这次经验固化为可复用的资产。"],
  ["迭代", "我们迭代，回看哪里可以更好，准备下一轮。"],
  ["中途", "停"],
];
const MACROS = [
  [
    "借力最优解",
    "调研外部成熟方案，先看主流实现怎么做的，再决定我们怎么做。不要从零发明。",
  ],
  [
    "全局视角出方案",
    "先看全景，把所有可行方案铺开比较，给我多个选项 + 取舍说明，我来拍板。",
  ],
  [
    "启动子代理并行调研",
    "启动多个子代理并行调研下述子方向，各自独立完成，最后汇总对比。",
  ],
  [
    "先出方案我拍板",
    "不要直接动手，先给我方案，我拍板后再动手。方案要包含目标、关键决策、风险、回滚方案。",
  ],
  ["推翻重来", "前面的方向不成立。不要在旧方案上修补，从目标重新推导一版。"],
  [
    "经得起推敲的方案",
    "每个关键决策写清依据、代价和被否掉的选项，经得起追问再交给我。",
  ],
];
const SCENES = [
  [
    "方案设计",
    "#8b7bff",
    [
      [
        "设计导出模块",
        "为 [项目名] 设计数据导出模块，包含格式选择、字段映射、权限校验，先给方案再写代码。",
      ],
      [
        "设计权限模型",
        "为 [项目名] 设计权限模型，先列实体与角色，再给授权流程。",
      ],
    ],
  ],
  [
    "调研",
    "#4c8dff",
    [
      [
        "调研主流方案",
        "调研当前主流的 [主题] 方案，给 3-5 个有代表性的选项，标注优缺点。",
      ],
      [
        "接手项目调研",
        "接手 [项目名]，从架构、依赖、测试覆盖、近期改动四个维度做一次现状摸排，产出一页纸总结。",
      ],
    ],
  ],
  [
    "排查",
    "#e0962f",
    [
      [
        "定位生产 bug 根因",
        "给你 [告警日志/堆栈]，请帮我定位根因，给出最小可验证假设和验证方法。",
      ],
      [
        "复现问题",
        "请帮我把 [bug 描述] 复现出来，给出最小复现步骤和环境要求。",
      ],
    ],
  ],
];
const RECENT = [
  ["借力最优解", "2m"],
  ["默认 · 规划", "9m"],
  ["调研主流方案", "21m"],
  ["停", "1h"],
];

/* ── Helpers ──────────────────────────────────────────────────── */
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "style") n.style.cssText = v;
    else n.setAttribute(k, v);
  }
  for (const k of kids) n.append(k);
  return n;
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ── Split headline into glyphs ───────────────────────────────── */
function splitHeadlines() {
  $$("[data-split]").forEach((line, li) => {
    const text = line.textContent;
    line.textContent = "";
    line.setAttribute("aria-label", text);
    [...text].forEach((ch, i) => {
      const s = el("span", { class: "ch", "aria-hidden": "true" }, ch);
      s.style.setProperty("--i", i);
      s.style.setProperty("--line", li);
      line.append(s);
    });
  });
  const go = () => document.documentElement.classList.add("is-ready");
  Promise.race([
    document.fonts.ready,
    new Promise((r) => setTimeout(r, 600)),
  ]).then(() => requestAnimationFrame(go));
}

/* ── Scroll reveals ───────────────────────────────────────────── */
function reveals() {
  const groups = new Map();
  $$("[data-reveal]").forEach((n) => {
    const p = n.parentElement;
    const i = groups.get(p) ?? 0;
    n.style.setProperty("--d", i);
    groups.set(p, i + 1);
  });
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: "0px 0px -12% 0px" },
  );
  $$("[data-reveal]").forEach((n) => io.observe(n));
}

/* ── Nav ──────────────────────────────────────────────────────── */
function nav() {
  const bar = $("[data-nav]");
  const links = $$(".nav__links a");
  const targets = links.map((a) => $(a.getAttribute("href")));
  return () => {
    bar.classList.toggle("is-scrolled", scrollY > 8);
    const mid = innerHeight * 0.4;
    let active = -1;
    targets.forEach((t, i) => {
      const r = t.getBoundingClientRect();
      if (r.top < mid && r.bottom > mid) active = i;
    });
    links.forEach((a, i) => a.classList.toggle("is-active", i === active));
  };
}

/* ── Cockpit replica ──────────────────────────────────────────── */
function cockpit() {
  const root = $("[data-cockpit]");
  const stage = $("[data-stage]");
  const phasesEl = $("[data-phases]", root);
  const alignEl = $("[data-align-text]", root);
  const statusPhase = $("[data-status-phase]", root);
  const latency = $("[data-latency]", root);
  const copiesEl = $("[data-copies]", root);
  const toast = $("[data-toast]", root);
  const recentEl = $("[data-recent]", root);
  let phase = 2;
  let copies = Number(copiesEl.textContent);
  let summoned = false;
  let scrim = null;
  let returnFocus = null;
  let toastTimer = 0;

  PHASES.forEach(([name], i) => {
    const b = el(
      "button",
      {
        type: "button",
        class: "ck-phase" + (i === 8 ? " ck-phase--live" : ""),
      },
      el("kbd", {}, String(i + 1)),
      name,
    );
    b.addEventListener("click", () => setPhase(i, true));
    phasesEl.append(el("li", {}, b));
  });

  const macros = $("[data-macros]", root);
  MACROS.forEach(([name, body], i) => {
    const b = el(
      "button",
      { type: "button", class: "ck-macro" },
      el("b", {}, name, el("kbd", {}, "⌘" + (i + 1))),
      el("span", {}, body),
    );
    b.addEventListener("click", () => {
      b.classList.add("is-copied");
      setTimeout(() => b.classList.remove("is-copied"), 600);
      use(name, body);
    });
    macros.append(b);
  });

  const scenes = $("[data-scenes]", root);
  SCENES.forEach(([name, color, phrases]) => {
    const list = el("ul");
    phrases.forEach(([p, body]) => {
      const b = el("button", { type: "button", class: "ck-phrase" }, p);
      b.addEventListener("click", () => use(p, body));
      list.append(el("li", {}, b));
    });
    const h = el(
      "p",
      { class: "ck-scene__h" },
      el("i", { style: `--c:${color}` }),
      name,
    );
    scenes.append(el("div", { class: "ck-scene" }, h, list));
  });

  RECENT.forEach(([n, t]) => recentEl.append(recentRow(n, t)));

  function recentRow(name, time) {
    return el("li", {}, el("span", {}, name), el("time", {}, time));
  }

  function setPhase(i, viaUser) {
    phase = i;
    $$(".ck-phase", root).forEach((b, j) =>
      b.setAttribute("aria-pressed", String(j === i)),
    );
    const [name, line] = PHASES[i];
    alignEl.textContent = line;
    statusPhase.textContent = "相位 · " + name;
    if (viaUser) use(i === 8 ? "停" : "默认 · " + name, line);
  }

  function showToast(text) {
    toast.textContent = text;
    toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-on"), 1400);
  }

  // Copy is the only verb. In the real app the overlay hides right after,
  // so the next sentence is typed by a person — not sent by the tool.
  async function use(name, body) {
    const ok = await copy(body);
    copies += 1;
    copiesEl.textContent = String(copies);
    const row = recentRow(name, "now");
    row.classList.add("is-new");
    recentEl.prepend(row);
    while (recentEl.children.length > 5) recentEl.lastElementChild.remove();
    showToast(ok ? `已复制 · ${name}` : `${name}`);
    if (summoned) setTimeout(dismiss, 260);
  }

  function summon(t0) {
    if (summoned) return;
    summoned = true;
    returnFocus = document.activeElement;
    stage.style.minHeight = stage.offsetHeight + "px";
    scrim = el("div", { class: "summon-scrim" });
    scrim.addEventListener("click", dismiss);
    document.body.append(scrim);
    document.documentElement.classList.add("is-summoned-root");
    root.classList.add("is-summoned");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    requestAnimationFrame(() => {
      scrim.classList.add("is-on");
      requestAnimationFrame(() => {
        const ms = Math.max(1, Math.round(performance.now() - t0));
        latency.textContent = `唤起 ${ms}ms · 上限 200ms`;
        latency.classList.add("is-hot");
      });
    });
    $(".ck-phase[aria-pressed='true']", root).focus({ preventScroll: true });
  }

  function dismiss() {
    if (!summoned) return;
    summoned = false;
    root.classList.remove("is-summoned");
    root.setAttribute("role", "region");
    root.removeAttribute("aria-modal");
    document.documentElement.classList.remove("is-summoned-root");
    scrim?.remove();
    scrim = null;
    stage.style.minHeight = "";
    returnFocus?.focus?.({ preventScroll: true });
  }

  const keyBtn = $("[data-summon]");
  keyBtn.addEventListener("click", (e) =>
    summon(e.timeStamp || performance.now()),
  );

  addEventListener("keydown", (e) => {
    if (e.altKey && e.code === "Space") {
      e.preventDefault();
      keyBtn.classList.add("is-down");
      if (summoned) dismiss();
      else summon(e.timeStamp);
      return;
    }
    if (!summoned) return;
    if (e.key === "Escape") {
      e.preventDefault();
      dismiss();
    } else if (/^[1-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey) {
      setPhase(Number(e.key) - 1, true);
    } else if (e.key === "Tab") {
      // Keep focus inside the overlay while it is up.
      const f = $$("button", root);
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  addEventListener("keyup", () => keyBtn.classList.remove("is-down"));

  setPhase(phase, false);

  // Tilt flattens as the replica scrolls into view.
  return () => {
    if (summoned || reduceMotion.matches) return;
    const r = stage.getBoundingClientRect();
    const t = clamp((r.top - innerHeight * 0.15) / (innerHeight * 0.75), 0, 1);
    root.style.setProperty("--tilt", t.toFixed(3));
  };
}

/* ── Gear shifter ─────────────────────────────────────────────── */
function gears() {
  const sec = $("[data-gears]");
  const knob = $("[data-knob]");
  const items = $$("[data-gearlist] li");
  const POS = {
    1: [60, 40],
    2: [60, 220],
    3: [160, 40],
    4: [160, 220],
    5: [260, 40],
  };
  const NEUTRAL = 130;
  const STEPS = ["1", "2", "3", "4", "5", "home"];
  let at = [60, 40];
  let step = -1;
  let anim = 0;

  const place = ([x, y]) =>
    knob.setAttribute("transform", `translate(${x} ${y})`);
  place(at);

  function route(from, to) {
    if (from[0] === to[0]) return [from, to];
    return [from, [from[0], NEUTRAL], [to[0], NEUTRAL], to];
  }

  function travel(to) {
    cancelAnimationFrame(anim);
    const pts = route(at, to);
    if (reduceMotion.matches) {
      at = to;
      place(at);
      return;
    }
    const segs = pts
      .slice(1)
      .map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
    const total = segs.reduce((a, b) => a + b, 0) || 1;
    const dur = 260 + total * 1.1;
    const start = performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
    const frame = (now) => {
      let d = ease(clamp((now - start) / dur, 0, 1)) * total;
      let i = 0;
      while (i < segs.length - 1 && d > segs[i]) d -= segs[i++];
      const k = segs[i] ? d / segs[i] : 1;
      const a = pts[i];
      const b = pts[i + 1];
      at = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
      place(at);
      if (now - start < dur) anim = requestAnimationFrame(frame);
    };
    anim = requestAnimationFrame(frame);
  }

  function setStep(s) {
    if (s === step) return;
    step = s;
    const key = STEPS[s];
    const gear = key === "home" ? "2" : key;
    sec.dataset.gearNow = key;
    items.forEach((li) =>
      li.classList.toggle("is-now", li.dataset.gear === gear),
    );
    travel(POS[gear]);
  }

  setStep(0);
  return () => {
    const r = sec.getBoundingClientRect();
    const span = r.height - innerHeight;
    const p = clamp(-r.top / span, 0, 0.9999);
    setStep(Math.floor(p * STEPS.length));
  };
}

/* ── Composer: Modifier → Composition → Macro ─────────────────── */
function composer() {
  const root = $("[data-composer]");
  const out = $("[data-sentence]", root);
  const count = $("[data-mod-count]", root);
  const slot = $("[data-macro-slot]", root);
  let frozen = 6;

  const picked = (group) =>
    $$(`[data-group="${group}"] .mod[aria-pressed="true"]`, root).map(
      (b) => b.dataset.mod,
    );

  function render() {
    const parts = [
      ["frag", "作为战略合伙人，"],
      ...picked("think").map((m) => ["m", m]),
      ["frag", "全面负责本次方案的完善，"],
      ...picked("act").map((m) => ["m", m]),
      ...picked("out").map((m) => ["m", m]),
      ...picked("limit").map((m) => ["m", m]),
    ];
    const last = parts[parts.length - 1];
    if (last[1].endsWith("，"))
      parts[parts.length - 1] = [last[0], last[1].slice(0, -1) + "。"];
    const prev = new Set(
      $$(".m", out).map((n) => n.textContent.replace(/。$/, "，")),
    );
    out.textContent = "";
    for (const [cls, text] of parts) {
      const s = el("span", { class: cls }, text);
      if (cls === "m" && prev.has(text.replace(/。$/, "，")))
        s.style.animation = "none";
      out.append(s);
    }
    const n = $$(".mod[aria-pressed='true']", root).length;
    count.textContent = `${n} 个 Modifier`;
  }

  $$(".mod", root).forEach((b) =>
    b.addEventListener("click", () => {
      b.setAttribute(
        "aria-pressed",
        String(b.getAttribute("aria-pressed") !== "true"),
      );
      render();
    }),
  );

  $("[data-freeze]", root).addEventListener("click", () => {
    const mods = $$(".mod[aria-pressed='true']", root).map((b) =>
      b.dataset.mod.replace(/[，。]$/, ""),
    );
    if (!mods.length) return;
    frozen += 1;
    const name = picked("out")[0]?.replace(/[，。]$/, "") ?? mods[0];
    const card = el(
      "div",
      { class: "macro-card" },
      el("kbd", {}, "⌘" + Math.min(frozen, 9)),
      el("b", {}, name),
      el("span", {}, "expandFrom · " + mods.join(" · ")),
    );
    slot.replaceChildren(card);
  });

  render();
}

/* ── Midway cues & drift ledger ───────────────────────────────── */
function cues() {
  const rows = $$("[data-ledger] > div");
  const total = $("[data-ledger-total]");
  const axes = rows.map((r) => $("dt", r).textContent);
  const counts = axes.map(() => 0);

  $$("[data-cue]").forEach((b) =>
    b.addEventListener("click", async () => {
      await copy(b.dataset.cue);
      const i = axes.indexOf(b.dataset.axis);
      counts[i] += 1;
      const max = Math.max(...counts);
      rows.forEach((r, j) => {
        $("b", r).textContent = String(counts[j]);
        $("i", r).style.setProperty("--v", (counts[j] / max).toFixed(3));
      });
      total.textContent = `${counts.reduce((a, c) => a + c, 0)} 笔`;
      b.classList.remove("is-hit");
      void b.offsetWidth;
      b.classList.add("is-hit");
      setTimeout(() => b.classList.remove("is-hit"), 220);
    }),
  );
}

/* ── Boot ─────────────────────────────────────────────────────── */
splitHeadlines();
reveals();
composer();
cues();
const onScroll = [nav(), cockpit(), gears()];
let ticking = false;
const tick = () => {
  ticking = false;
  onScroll.forEach((f) => f());
};
const schedule = () => {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(tick);
  }
};
addEventListener("scroll", schedule, { passive: true });
addEventListener("resize", schedule);
tick();
