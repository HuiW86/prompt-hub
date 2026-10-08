// English copy, keyed by selector. Chinese is the source of truth and lives
// in index.html; it is captured from the DOM at boot so switching back is
// lossless. The cockpit demo stays in Chinese on purpose: that is the
// content the app ships with.

export const EN_META = {
  title: "prompt-hub · A cockpit for the manual-gear stage",
  description:
    "prompt-hub is a desktop dashboard for the manual-gear stage of AI coding: summon it with ⌥Space, see phases, scenes and phrases on one screen, copy and go. Your data never leaves the machine.",
};

export const EN = [
  [".skip", "Skip to content"],
  [".nav__brand", null, { "aria-label": "prompt-hub home" }],
  [".nav__links", null, { "aria-label": "Sections" }],
  [".nav__links [href='#gears']", "Gears"],
  [".nav__links [href='#layers']", "Layers"],
  [".nav__links [href='#midway']", "Midway"],
  [".nav__links [href='#bounds']", "Bounds"],
  [".nav .btn", "Download for macOS"],
  [
    ".eyebrow",
    '<span class="eyebrow__dot"></span>AI coding · a cockpit for the manual-gear stage',
  ],
  [".hero__title .line:nth-child(1)", "Hands on"],
  [".hero__title .line:nth-child(2)", "the wheel."],
  [
    ".hero__lede",
    "prompt-hub is a full-screen dashboard you summon with a hotkey. Phases, scenes, phrases and recent use share one screen: see it all, copy and go, and say the next line yourself.",
  ],
  [
    ".hero__hint",
    '<span class="hide-touch">Press ⌥ Space or click here</span><span class="show-touch">Tap here</span> to summon the dashboard.<br /><span class="mono muted">Esc to dismiss</span>',
  ],
  [
    "[data-cockpit]",
    null,
    {
      "aria-label":
        "prompt-hub dashboard demo (content in Chinese, as shipped)",
    },
  ],

  ["#gears .kicker", '<span class="mono">01</span> Five gears'],
  ["#gears-title", "AI coding has five gears.<br />This is the second."],
  [
    ".gears__intro .body",
    "Not “beginner to expert”. Driving carries two premises that ladder lacks: the human always holds the wheel, and every gear is built on the one before.",
  ],
  [
    "[data-verdict]",
    "Automate too early and an unstable SOP hardens into a mistake.<br /><strong>Hold the line, and you can go deep.</strong>",
  ],
  ["[data-gear='1'] h3", "SOP"],
  [
    "[data-gear='1'] p",
    "Write tacit working methods down as phrases and templates. A notebook is enough.",
  ],
  ["[data-gear='2'] h3", 'Manual <span class="tag">prompt-hub</span>'],
  [
    "[data-gear='2'] p",
    "You drive; the tool only shows and recalls. See what you are doing, what you could do, and what usually comes next.",
  ],
  ["[data-gear='3'] h3", "Automatic"],
  [
    "[data-gear='3'] p",
    "The tool runs a stretch on its own; you set start and finish. Slash-command territory.",
  ],
  ["[data-gear='4'] h3", "Assisted"],
  [
    "[data-gear='4'] p",
    "Human and machine decide together, in real time. Plan mode plus subagents.",
  ],
  ["[data-gear='5'] h3", "Autonomous"],
  [
    "[data-gear='5'] p",
    "AI delivers end to end. Out of reach for now: every extra decision point compounds the drift.",
  ],

  ["#layers .kicker", '<span class="mono">02</span> Three layers'],
  [
    "#layers-title",
    "Half-sentences make a sentence.<br />A sentence becomes a key.",
  ],
  [
    "#layers .section-head .body",
    "A Modifier is a methodological atom. It ends in a comma because it exists to be joined. A Composition joins them in a fixed order: framing, then action, then output, then constraints. A combination that keeps coming back is promoted to a Macro. Three layers, never a fourth.",
  ],
  ["[data-group='think'] .modgroup__h", '<span class="mono">Framing</span>'],
  ["[data-group='act'] .modgroup__h", '<span class="mono">Action</span>'],
  ["[data-group='out'] .modgroup__h", '<span class="mono">Output</span>'],
  [
    "[data-group='limit'] .modgroup__h",
    '<span class="mono">Constraints</span>',
  ],
  ["[data-freeze]", "Freeze as Macro"],
  [
    ".composer__actions .muted",
    "Traceable: every Macro remembers which Modifiers it was built from.",
  ],

  ["#midway .kicker", '<span class="mono">03</span> Protocol layer'],
  [
    "#midway-title",
    'Alignment isn’t only for the opening.<br /><span class="accent">Drift happens midway.</span>',
  ],
  [
    "#midway .section-head .body",
    "Set the frame, then hand over the task: eight phases, each with a default alignment line, one keystroke away on ⌘1 to ⌘8. When the conversation wanders, ⌘9 is Midway: six one-line cues. Copy one and you have shifted.",
  ],
  [".cues__pad", null, { "aria-label": "Midway cues, click to copy" }],
  [".ledger__h span:first-child", "Drift ledger · this session"],
  [".ledger__note", "Every copy is an entry. No new button, no “log” action."],
  ["[data-ledger] > div:nth-child(1) dt", "Form"],
  ["[data-ledger] > div:nth-child(2) dt", "Layer"],
  ["[data-ledger] > div:nth-child(3) dt", "Domain"],
  ["[data-ledger] > div:nth-child(4) dt", "Mode"],
  ["[data-ledger] > div:nth-child(5) dt", "Stop"],

  ["#bounds .kicker", '<span class="mono">04</span> Bounds'],
  ["#bounds-title", "What it refuses to be<br />matters more than what it is."],
  [
    ".nots li:nth-child(1)",
    "<s>A prettier prompt manager</s><span>There are plenty. Not competing with them.</span>",
  ],
  [
    ".nots li:nth-child(2)",
    "<s>A faster launcher</s><span>Text expansion will always win on speed.</span>",
  ],
  [
    ".nots li:nth-child(3)",
    "<s>An AI autopilot</s><span>No orchestration, no execution, no agent loop.</span>",
  ],
  [
    ".nots li:nth-child(4)",
    "<s>A team knowledge base</s><span>One person, one machine. No accounts, no share links.</span>",
  ],
  [".law:nth-child(1) .law__n", "200<small>ms</small>"],
  [".law:nth-child(1) h3", "On call"],
  [
    ".law:nth-child(1) p:last-child",
    "Hotkey to fully interactive within 200ms at P95. Any slower and the overlay gets abandoned. Measured: about 14ms P95 for the show call, before roughly 10ms of OS shortcut dispatch.",
  ],
  [".law:nth-child(2) .law__n", "0<small>bytes</small>"],
  [".law:nth-child(2) h3", "Stays on the machine"],
  [
    ".law:nth-child(2) p:last-child",
    "Every asset lives in a local SQLite file. No server calls, no cloud sync. Your phrases carry your working fingerprint.",
  ],
  [".law:nth-child(3) .law__n", "0<small>calls</small>"],
  [".law:nth-child(3) h3", "Never writes for you"],
  [
    ".law:nth-child(3) p:last-child",
    "No language model inside: nothing generated, rewritten or recommended. After the copy, pasting and sending are yours. That pause is room to think.",
  ],

  ["#close-title", "The next line<br />is yours."],
  [".close__cta .btn", "Download for macOS"],
  [
    ".close__cta p",
    "macOS only · Developer ID signed and notarized · in-app updates",
  ],
  [".foot .muted", "No analytics or third-party scripts on this site."],
];

// Labels painted on the cue tiles (CSS reads data-label); the Chinese axis
// in data-axis stays the ledger key.
export const AXIS_EN = {
  形态: "Form",
  层级: "Layer",
  领域: "Domain",
  模式: "Mode",
  停: "Stop",
};
