import { MacroGrid } from "../components/MacroGrid";
import { PhaseBar } from "../components/PhaseBar";
import { RecentList } from "../components/RecentList";
import { ScenePanel } from "../components/ScenePanel";
import { SearchBar } from "../components/SearchBar";
import { SopProgress } from "../components/SopProgress";
import { StatusBar } from "../components/StatusBar";
import { Toast } from "../components/Toast";
import { usePromptStore } from "../stores/promptStore";

import styles from "./Dashboard.module.css";

export function Dashboard() {
  const loadState = usePromptStore((s) => s.loadState);
  const loadError = usePromptStore((s) => s.loadError);

  if (loadState === "idle" || loadState === "loading") {
    return <div className={styles.loading}>加载中…</div>;
  }
  if (loadState === "error") {
    return <div className={styles.error}>加载失败：{loadError}</div>;
  }

  return (
    <div
      className={styles.dashboard}
      role="application"
      aria-label="prompt-hub dashboard"
    >
      <SearchBar />
      <PhaseBar />
      <div className={styles.rowMain}>
        <MacroGrid />
        <ScenePanel />
      </div>
      <div className={styles.rowFooter}>
        <RecentList />
        <SopProgress />
      </div>
      <StatusBar />
      <Toast />
    </div>
  );
}
