/* global React, PhaseBar, AlignmentPhrases, MacroGrid, SceneList, AuxPanel, StatusBar, Icon, Kbd */
const { useState, useEffect, useRef, useMemo } = React;

/* ------- Seed data ------- */
const PHASES = [
  { id: "scan",    label: "scan" },
  { id: "plan",    label: "plan" },
  { id: "compose", label: "compose" },
  { id: "review",  label: "review" },
  { id: "land",    label: "land" },
];

const SEED_PHRASES = [
  { id: "tight",    label: "tight-loop" },
  { id: "ship",     label: "ship-before-perfect" },
  { id: "no-todos", label: "no-todos-without-context" },
  { id: "small",    label: "smallest-diff-first" },
  { id: "test",     label: "test-before-ship" },
];

const MACROS = [
  { id: "refactor", title: "Refactor selection",       body: "Splits a selection into a named component. Updates call sites and imports.",          hotkey: "⌘1", uses: 142, lastUsed: "3m",  icon: "layers" },
  { id: "extract",  title: "Extract function",         body: "Lift the highlighted block into a top-level function with inferred signature.",         hotkey: "⌘2", uses: 88,  lastUsed: "14m", icon: "box" },
  { id: "test",     title: "Add test for selection",   body: "Generates a vitest test that exercises the highlighted code path with realistic inputs.", hotkey: "⌘3", uses: 64,  lastUsed: "1h",  icon: "circle-check" },
  { id: "trace",    title: "Trace symbol",             body: "Walks every reference to the cursor symbol, summarizes call-chains and side effects.",   hotkey: "⌘4", uses: 51,  lastUsed: "2h",  icon: "git-branch" },
  { id: "bisect",   title: "Bisect failing test",      body: "Binary-searches commits between HEAD and a known-good ref for the first red commit.",   hotkey: "⌘5", uses: 27,  lastUsed: "1d",  icon: "git-commit-horizontal" },
  { id: "summary",  title: "Summarize diff",           body: "Reads the working diff and emits a 2-paragraph review summary in commit-message tone.",  hotkey: "⌘6", uses: 33,  lastUsed: "4h",  icon: "file-code" },
  { id: "docstr",   title: "Generate docstring",       body: "Writes a JSDoc/TSDoc block matching the function signature and inferred semantics.",     hotkey: "⌘7", uses: 19,  lastUsed: "2d",  icon: "type" },
  { id: "lint",     title: "Run linter on changed",    body: "Runs eslint + prettier across the working set and surfaces only newly introduced violations.", hotkey: "⌘8", uses: 12,  lastUsed: "3d",  icon: "filter" },
  { id: "loop",     title: "Tight-loop on test",       body: "Re-runs the focused test on every save; stops on first green, shows diff.",               hotkey: "⌘9", uses: 9,   lastUsed: "5d",  icon: "rotate-cw" },
];

const SEED_SCENES = [
  { id: "s1", name: "composer-rewrite",         path: "src/composer.tsx",         state: "running", duration: "2m 14s",  age: 134 },
  { id: "s2", name: "refactor-selection-modal", path: "src/modals/ref.tsx",       state: "running", duration: "1m 02s",  age: 62 },
  { id: "s3", name: "flaky-test-bisect",        path: "tests/scenes.test.ts",     state: "idle",    duration: "8m 47s",  age: 527 },
];

function fmtDur(secs) {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
function fmtAgo(secs) {
  if (secs < 60)    return `${secs}s`;
  if (secs < 3600)  return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

function App() {
  const [activePhase, setActivePhase]   = useState("plan");
  const [phaseTimers, setPhaseTimers]   = useState({ scan: 42, plan: 68, compose: 0, review: 0, land: 0 });
  const [activeIds, setActiveIds]       = useState(["tight", "small"]);
  const [scenes, setScenes]             = useState(SEED_SCENES);
  const [activeSceneId, setActiveScene] = useState("s2");
  const [tokens, setTokens]             = useState(12481);
  const [quickFindOpen, setQuickFindOpen] = useState(false);
  const [helpOpen, setHelpOpen]         = useState(false);
  const qfRef = useRef(null);

  /* Tick: phase timer + scene ages + token drift */
  useEffect(() => {
    const t = setInterval(() => {
      setPhaseTimers((p) => ({ ...p, [activePhase]: p[activePhase] + 1 }));
      setScenes((ss) =>
        ss.map((s) => (s.state === "running" ? { ...s, age: s.age + 1, duration: fmtDur(s.age + 1) } : s))
      );
      setTokens((t) => t + Math.floor(Math.random() * 23));
    }, 1000);
    return () => clearInterval(t);
  }, [activePhase]);

  /* Hotkeys */
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuickFindOpen(true);
        setTimeout(() => qfRef.current?.focus(), 30);
      } else if (e.key === "Escape") {
        setQuickFindOpen(false);
        setHelpOpen(false);
      } else if (e.key === "?" && !quickFindOpen) {
        setHelpOpen((v) => !v);
      } else if (/^[1-9]$/.test(e.key) && (e.metaKey || e.ctrlKey)) {
        const idx = +e.key - 1;
        if (MACROS[idx]) { e.preventDefault(); fireMacro(MACROS[idx]); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quickFindOpen]);

  /* Mutators */
  function togglePhrase(id) {
    setActiveIds((curr) => (curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]));
  }
  function fireMacro(m) {
    const id = "s" + (Math.random().toString(36).slice(2, 7));
    const name = m.id + "-" + Math.floor(Math.random() * 99 + 1).toString().padStart(2, "0");
    const path = ["src/", "app/", "lib/"][Math.floor(Math.random() * 3)] +
                 ["composer", "registry", "phases", "macros", "scenes"][Math.floor(Math.random() * 5)] +
                 [".ts", ".tsx", ".test.ts"][Math.floor(Math.random() * 3)];
    setScenes((ss) => [{ id, name, path, state: "running", duration: "0s", age: 0 }, ...ss]);
    setActiveScene(id);
  }

  /* Derived */
  const phases = PHASES.map((p) => ({ ...p, timer: fmtAgo(phaseTimers[p.id]) }));
  const runningScenes = scenes.filter((s) => s.state === "running");
  const totalRunSecs = runningScenes.reduce((a, b) => a + b.age, 0);
  const decorated = scenes.map((s, i) =>
    i === 0 ? { ...s, totalLabel: fmtDur(totalRunSecs) } : s
  );

  const stats = {
    model: "claude-haiku-4.5",
    tokens,
    cost: tokens * 0.000003 * 1000, // pretend
    uptime: fmtAgo(phaseTimers.scan + phaseTimers.plan + phaseTimers.compose),
    branch: "feat/composer-rewrite",
    dirty: 7,
    lastCommit: "12m",
    recent: [
      { label: "composer-rewrite",      ago: "now" },
      { label: "refactor-selection",    ago: "1m" },
      { label: "phases.ts → onChange",  ago: "3m" },
      { label: "test: scene-spawn",     ago: "8m" },
      { label: "tighten alignment list", ago: "14m" },
    ],
  };

  return (
    <>
      <div className="overlay">
        {quickFindOpen && (
          <div className="quickfind">
            <Icon name="search" size={14} className="ic ic-aux" />
            <input
              ref={qfRef}
              placeholder="Find macros, scenes, files…"
              onBlur={() => setQuickFindOpen(false)}
            />
            <Kbd>⎋</Kbd>
          </div>
        )}

        <PhaseBar phases={phases} activeId={activePhase} onSelect={setActivePhase} />

        <AlignmentPhrases
          phrases={SEED_PHRASES}
          activeIds={activeIds}
          onToggle={togglePhrase}
          onAdd={() => {}}
        />

        <div className="panorama">
          <MacroGrid macros={MACROS} onFire={fireMacro} />
          <SceneList scenes={decorated} activeId={activeSceneId} onSelect={setActiveScene} />
          <AuxPanel stats={stats} />
        </div>

        <StatusBar
          connected
          model={stats.model}
          phase={activePhase}
          sceneCount={runningScenes.length}
          totalDuration={fmtDur(totalRunSecs)}
          tokens={tokens}
        />

        {helpOpen && <HelpOverlay onClose={() => setHelpOpen(false)} />}
      </div>
    </>
  );
}

function HelpOverlay({ onClose }) {
  const bindings = [
    ["⌥Space",  "wake overlay"],
    ["⌘K",      "quick find"],
    ["⌘1-9",    "fire macro N"],
    ["⌘N",      "new macro"],
    ["⌘⇧N",     "new scene"],
    ["/",       "filter scenes"],
    ["⏎",       "open selected"],
    ["⎋",       "dismiss"],
    ["?",       "this help"],
  ];
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(7,7,10,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 50
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-2)",
          borderRadius: "var(--r-4)",
          padding: "16px 18px",
          minWidth: 320
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <div className="ph-region-header">Keyboard</div>
          <Kbd>⎋</Kbd>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 18px", alignItems: "center" }}>
          {bindings.map(([k, v]) => (
            <React.Fragment key={k}>
              <Kbd>{k}</Kbd>
              <span style={{ font: "400 13px/1 var(--font-sans)", color: "var(--fg-2)" }}>{v}</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
