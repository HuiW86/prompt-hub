import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";

import { Header } from "../components/Header";
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
import { usePromptStore } from "../stores/promptStore";

import styles from "./Dashboard.module.css";

export function Dashboard() {
  const loadState = usePromptStore((s) => s.loadState);
  const loadError = usePromptStore((s) => s.loadError);

  // Column widths are a local UI preference: persisted to localStorage (never
  // SQLite, never uploaded — constitution A2). useDefaultLayout restores the
  // saved layout on mount and onLayoutChanged writes back after a drag settles.
  // The id is bumped (-2col) so the prior 3-column layout in localStorage is
  // discarded after the Promptscape task-layer absorption.
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "panorama-2col",
    storage: localStorage,
  });

  if (loadState === "idle" || loadState === "loading") {
    return <div className={styles.loading}>加载中…</div>;
  }
  if (loadState === "error") {
    return <div className={styles.error}>加载失败：{loadError}</div>;
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
      <UpdaterBanner />
      <Header />
      <ProtocolBand />
      <div className={styles.panorama}>
        <Group
          id="panorama-2col"
          className={styles.panoramaGroup}
          defaultLayout={defaultLayout}
          onLayoutChanged={onLayoutChanged}
        >
          <Panel
            id="task"
            className={styles.panel}
            defaultSize="68%"
            minSize="42%"
          >
            {/* Task column: Macro strip pinned on top, Scene panorama fills. */}
            <div className={styles.taskCol}>
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
      <StatusBar />
      <Toast />
      <SettingsModal />
    </div>
  );
}
