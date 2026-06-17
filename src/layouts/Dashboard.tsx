import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";

import { AlignmentPhrases } from "../components/AlignmentPhrases";
import { CompositionWorkbench } from "../components/CompositionWorkbench";
import { MacroGrid } from "../components/MacroGrid";
import { ModifierGrid } from "../components/ModifierGrid";
import { PhaseBar } from "../components/PhaseBar";
import { RecentList } from "../components/RecentList";
import { ScenePanel } from "../components/ScenePanel";
import { SearchBar } from "../components/SearchBar";
import { SearchOverlay } from "../components/SearchOverlay";
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
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "panorama-cols",
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
    // and heading rotors (VO+U / H / K). The dashboard is composed of standard
    // landmarks (search, nav, sections, contentinfo); switching the whole shell
    // into application mode would suppress that AT navigation, defeating the
    // five Tab-reachable regions added in B5-5. See review C-P1-1.
    <div
      className={styles.dashboard}
      role="main"
      aria-label="prompt-hub dashboard"
    >
      <UpdaterBanner />
      <SearchBar />
      <PhaseBar />
      <AlignmentPhrases />
      <div className={styles.panorama}>
        <Group
          id="panorama-cols"
          className={styles.panoramaGroup}
          defaultLayout={defaultLayout}
          onLayoutChanged={onLayoutChanged}
        >
          <Panel
            id="macro"
            className={styles.panel}
            defaultSize="42%"
            minSize="22%"
          >
            <MacroGrid />
          </Panel>
          <Separator className={styles.separator} />
          <Panel
            id="scene"
            className={styles.panel}
            defaultSize="30%"
            minSize="18%"
          >
            <div className={styles.sceneCol}>
              <ScenePanel />
              <CompositionWorkbench />
            </div>
          </Panel>
          <Separator className={styles.separator} />
          <Panel
            id="col3"
            className={styles.panel}
            defaultSize="28%"
            minSize="18%"
          >
            <div className={styles.col3}>
              <RecentList />
              <ModifierGrid />
              <SopProgress />
            </div>
          </Panel>
        </Group>
        <SearchOverlay />
      </div>
      <StatusBar />
      <Toast />
    </div>
  );
}
