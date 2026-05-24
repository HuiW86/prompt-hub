import { useAppStore } from "../stores/appStore";
import { usePromptStore } from "../stores/promptStore";

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
        <span>新建</span>
        <Kbd sm>⌘N</Kbd>
      </span>
      <span className={styles.grp}>
        <span>设置</span>
        <Kbd sm>⌘,</Kbd>
      </span>
    </footer>
  );
}
