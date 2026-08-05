import { useAppStore } from "../stores/appStore";
import { usePromptStore } from "../stores/promptStore";
import { useUpdaterStore } from "../stores/updaterStore";

import { Kbd } from "./primitives";
import styles from "./StatusBar.module.css";

// B5-6: real day-bounded copy count + live active-phase label.
// 03-product-spec §13.3 区域 7 calls for "今日复制 N 次 · 当前相位 · 草稿待沉淀";
// the third item lands when sediment workflow ships later.
export function StatusBar() {
  const todayCount = usePromptStore((s) => s.todayCount);
  const activePhaseId = useAppStore((s) => s.activePhaseId);
  // Short-circuit when no phase is active so we skip an 8-item scan AND avoid
  // subscribing to `phases` when there's nothing to look up — the selector
  // closure still re-reads on every setState, but Zustand's strict-equality
  // bail-out keeps the bare-string "未选" stable across renders. Review A-P1-2.
  const activePhaseName = usePromptStore((s) =>
    activePhaseId == null
      ? "未选"
      : (s.phases.find((p) => p.id === activePhaseId)?.name ?? "未选"),
  );
  const hasActivePhase = activePhaseId != null;

  // ADR-017 §5.3: manual "检查更新" entry. When the total switch is off the
  // entry instead re-opens the opt-in prompt so a declined user has a path back
  // — there is no settings panel yet (settingsStore is in-memory MVP).
  const updaterEnabled = useUpdaterStore((s) => s.enabled);
  const updaterStatus = useUpdaterStore((s) => s.status);
  const checkUpdate = useUpdaterStore((s) => s.check);
  const reopenOptIn = useUpdaterStore((s) => s.reopenOptIn);
  // Failure surfaces here (not as a banner — UI reshape / ADR-023): the label
  // names the failure and the button itself is the retry path.
  const updaterLabel = !updaterEnabled
    ? "更新已关闭"
    : updaterStatus === "checking"
      ? "检查中…"
      : updaterStatus === "error"
        ? "更新失败 · 重试"
        : "检查更新";

  return (
    <footer
      className={styles.statusBar}
      aria-label="状态栏"
      data-region="status-bar"
    >
      <span className={styles.grp}>
        <span
          className={`${styles.dot} ${hasActivePhase ? styles.dotProto : styles.dotIdle}`}
          aria-hidden
        />
        <span>
          当前相位：{activePhaseName}
          <span className={styles.srOnly}>。</span>
        </span>
      </span>
      <span className={styles.sep} aria-hidden />
      <span className={`${styles.grp} ${styles.mono}`}>
        今日复制 {todayCount} 次<span className={styles.srOnly}>。</span>
      </span>
      <span className={styles.spacer} />
      <span className={styles.grp}>
        <span>搜索</span>
        <Kbd sm>⌘K</Kbd>
      </span>
      <span className={styles.grp}>
        <span>复制</span>
        <Kbd sm>⏎</Kbd>
      </span>
      <span className={styles.grp}>
        <span>设置</span>
        <Kbd sm>⌘,</Kbd>
      </span>
      <button
        type="button"
        className={styles.updater}
        onClick={() =>
          updaterEnabled ? void checkUpdate(true) : reopenOptIn()
        }
        disabled={updaterStatus === "checking"}
        // Keep StatusBar out of the region-level Tab cycle (same pattern as the
        // DraftInbox badge); the banner is the keyboard-reachable surface.
        tabIndex={-1}
      >
        {updaterLabel}
      </button>
    </footer>
  );
}
