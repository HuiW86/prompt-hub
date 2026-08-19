import { Box } from "lucide-react";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";

import { Header } from "../components/Header";
import { HotkeyBanner } from "../components/HotkeyBanner";
import { MacroGrid } from "../components/MacroGrid";
import { ModifierGrid } from "../components/ModifierGrid";
import { ProtocolBand } from "../components/ProtocolBand";
import { RecentList } from "../components/RecentList";
import { ScenePanel } from "../components/ScenePanel";
import { SearchOverlay } from "../components/SearchOverlay";
import { SettingsModal } from "../components/SettingsModal";
import { SopProgress } from "../components/SopProgress";
import { StatusBar } from "../components/StatusBar";
import { Toast } from "../components/Toast";
import { UpdaterBanner } from "../components/UpdaterBanner";
import { Button } from "../components/primitives";
import { usePromptStore } from "../stores/promptStore";

import styles from "./Dashboard.module.css";

// ONE spatial layout, both modes (ADR-026). `interactionMode` changes click
// semantics and action affordances only — never where a region lives. The
// former dual arrangement moved three of five regions across columns on every
// toggle, which cost the spatial memory a dashboard exists to build, and it
// broke three ratified contracts on the way (product-spec §4.0.7 scope /
// §13.3 region-6 position / §13.4 Tab order).
//
// Region map (fixed): task column = Macro over Scene; aside = Modifier,
// recent wake, SOP. DOM order resolves to the §13.4 Tab sequence.
//
// The one thing the old cockpit had right — Macro deserves more room than a
// 200px strip (2026-08-10 hit-probability evidence) — survives as a draggable
// split rather than a second layout: a binary mode cannot carry a continuous
// spatial preference, so the preference goes to a continuous control.
export function Dashboard() {
  const loadState = usePromptStore((s) => s.loadState);
  const loadError = usePromptStore((s) => s.loadError);
  const refreshAll = usePromptStore((s) => s.refreshAll);

  // Split sizes are a local UI preference: persisted to localStorage (never
  // SQLite, never uploaded — constitution A2). One id per split, shared by both
  // modes. The retired per-mode ids (panorama-2col / cockpit-2col) are left in
  // storage unread: a stale UI preference falls back to the default, so a
  // migration would cost more than it is worth (ADR-026 子决策 3).
  const columnLayout = useDefaultLayout({
    id: "dashboard-2col",
    storage: localStorage,
  });
  const taskLayout = useDefaultLayout({
    id: "task-2row",
    storage: localStorage,
  });

  if (loadState === "idle" || loadState === "loading") {
    return <div className={styles.loading}>加载中…</div>;
  }
  if (loadState === "error") {
    // Not a dead end: 重试 re-runs the full initial load (refreshAll) without
    // requiring an app restart, e.g. after a transient IPC/SQLite hiccup.
    return (
      <div className={styles.error} role="alert">
        <span>加载失败：{loadError}</span>
        <Button intent="ghost" onClick={() => void refreshAll()}>
          重试
        </Button>
      </div>
    );
  }

  return (
    // role="main" (not "application") so VoiceOver / NVDA keep their landmark
    // and heading rotors. The dashboard is composed of standard landmarks
    // (search, nav, sections, contentinfo); see review C-P1-1.
    <div
      className={styles.dashboard}
      role="main"
      aria-label="prompt-hub dashboard"
    >
      <HotkeyBanner />
      <UpdaterBanner />
      <Header />
      <ProtocolBand />
      <div className={styles.panorama}>
        <Group
          id="dashboard-2col"
          className={styles.panoramaGroup}
          defaultLayout={columnLayout.defaultLayout}
          onLayoutChanged={columnLayout.onLayoutChanged}
        >
          <Panel
            id="task"
            className={styles.panel}
            defaultSize="68%"
            minSize="42%"
          >
            {/* Task column: 任务层 marker, then the Macro / Scene split. */}
            <div className={styles.taskCol}>
              <div className={styles.taskLayerHead}>
                <span className={styles.taskPill}>
                  <Box size={12} strokeWidth={2} aria-hidden />
                  任务层
                </span>
              </div>
              <Group
                id="task-2row"
                orientation="vertical"
                className={styles.taskGroup}
                defaultLayout={taskLayout.defaultLayout}
                onLayoutChanged={taskLayout.onLayoutChanged}
              >
                {/* Default leans to Macro (0-step reach, heat-sorted). Both
                    minimums are PIXELS, not percentages: a percentage floor
                    keeps shrinking with the window, so the region thins out
                    exactly when space is scarcest — that is how the old
                    cockpit wake ended up ~1 row tall.

                    Both floors mean the same thing: ONE COMPLETE UNIT PLUS THE
                    EDGE OF THE NEXT. The peeking next unit is itself the
                    "there is more below" cue, which is why neither region
                    needs a scroll shadow or arrow. Measured on device
                    (2026-08-19), not derived from tokens — region chrome
                    stacks in ways the token values alone don't predict. */}
                <Panel
                  id="macro"
                  className={styles.panel}
                  defaultSize="46%"
                  minSize="132px"
                >
                  <MacroGrid />
                </Panel>
                <Separator className={styles.separatorRow} />
                {/* 288px = region header + tab row + card head (224) + first
                    phrase card in full (→265) + the next card's edge (→288).
                    The earlier 196px cleared the chrome but left ZERO phrases
                    visible, and ScenePanel hides its scrollbar, so the region
                    read as empty rather than scrollable — it failed ADR-026
                    子决策 2's own wording ("下限保证 Scene 至少完整显示一个子阶段列"). */}
                <Panel
                  id="scene"
                  className={styles.panel}
                  defaultSize="54%"
                  minSize="288px"
                >
                  <ScenePanel />
                </Panel>
              </Group>
            </div>
          </Panel>
          <Separator className={styles.separator} />
          <Panel
            id="aside"
            className={styles.panel}
            defaultSize="32%"
            minSize="20%"
          >
            <div className={styles.aside}>
              <ModifierGrid />
              <RecentList />
              <SopProgress />
            </div>
          </Panel>
        </Group>
        <SearchOverlay />
      </div>
      <StatusBar />
      <Toast />
      <SettingsModal />
    </div>
  );
}
