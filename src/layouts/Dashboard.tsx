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
import { useSettingsStore } from "../stores/settingsStore";

import styles from "./Dashboard.module.css";

// Reshape v2 dual-layout: the interaction mode drives the ARRANGEMENT, not
// just click behaviour (D-0 extended). Same six regions, two compositions:
//   调用态 cockpit — the grab-and-go moment dominates: hot Macro tiles + the
//     recent-usage wake take the wide column, the active Scene shrinks to a
//     context rail, Modifier atoms dock as a bottom tray.
//   整理态 studio — the asset panorama dominates: Macro strip atop the Scene
//     panorama (task column), Modifier/Recent/SOP as the classic aside.
// All regions stay on-screen in both modes (哲学二 同屏可见); only share of
// screen and order change with the moment.
export function Dashboard() {
  const loadState = usePromptStore((s) => s.loadState);
  const loadError = usePromptStore((s) => s.loadError);
  const refreshAll = usePromptStore((s) => s.refreshAll);
  const interactionMode = useSettingsStore((s) => s.interactionMode);

  // Column widths are a local UI preference: persisted to localStorage (never
  // SQLite, never uploaded — constitution A2). Each mode owns its split id so
  // cockpit and studio remember their widths independently.
  const studioLayout = useDefaultLayout({
    id: "panorama-2col",
    storage: localStorage,
  });
  const cockpitLayout = useDefaultLayout({
    id: "cockpit-2col",
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

  const cockpit = interactionMode === "invoke";

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
      {cockpit ? (
        <>
          <div className={styles.panorama}>
            <Group
              id="cockpit-2col"
              className={styles.panoramaGroup}
              defaultLayout={cockpitLayout.defaultLayout}
              onLayoutChanged={cockpitLayout.onLayoutChanged}
            >
              <Panel
                id="hot"
                className={styles.panel}
                defaultSize="62%"
                minSize="42%"
              >
                {/* Hot zone: heat-sorted macro tiles + the usage wake. */}
                <div className={styles.cockpitMain}>
                  <MacroGrid />
                  <RecentList />
                </div>
              </Panel>
              <Separator className={styles.separator} />
              <Panel
                id="context"
                className={styles.panel}
                defaultSize="38%"
                minSize="24%"
              >
                {/* Context rail: where am I — active scene + SOP position. */}
                <div className={styles.cockpitRail}>
                  <ScenePanel />
                  <SopProgress />
                </div>
              </Panel>
            </Group>
            <SearchOverlay />
          </div>
          {/* Atom tray: Modifier pool stays on-screen, docked low. */}
          <div className={styles.modifierTray}>
            <ModifierGrid />
          </div>
        </>
      ) : (
        <div className={styles.panorama}>
          <Group
            id="panorama-2col"
            className={styles.panoramaGroup}
            defaultLayout={studioLayout.defaultLayout}
            onLayoutChanged={studioLayout.onLayoutChanged}
          >
            <Panel
              id="task"
              className={styles.panel}
              defaultSize="68%"
              minSize="42%"
            >
              {/* Task column: 任务层 marker, Macro strip, then Scene panorama. */}
              <div className={styles.taskCol}>
                <div className={styles.taskLayerHead}>
                  <span className={styles.taskPill}>
                    <Box size={12} strokeWidth={2} aria-hidden />
                    任务层
                  </span>
                </div>
                <div className={styles.macroSlot}>
                  <MacroGrid />
                </div>
                <ScenePanel />
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
      )}
      <StatusBar />
      <Toast />
      <SettingsModal />
    </div>
  );
}
