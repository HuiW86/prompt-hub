import { useAppStore } from "../stores/appStore";
import { usePromptStore } from "../stores/promptStore";

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

  return (
    <footer
      className={styles.statusBar}
      aria-label="状态栏"
      data-region="status-bar"
    >
      <div className={styles.left}>
        {/* The visible `·` is decorative; screen readers would otherwise concat
         * "今日复制 17 次当前相位：发散" with no pause. Each data span ends with
         * an sr-only 句号 so VoiceOver / NVDA insert a natural sentence break.
         * Review C-P1-4. */}
        <span>
          今日复制 {todayCount} 次<span className={styles.srOnly}>。</span>
        </span>
        <span aria-hidden>·</span>
        <span>
          当前相位：{activePhaseName}
          <span className={styles.srOnly}>。</span>
        </span>
      </div>
      <div className={styles.right}>
        <kbd className={styles.shortcut}>⌘K 搜索</kbd>
        <kbd className={styles.shortcut}>⏎ 复制</kbd>
        <kbd className={styles.shortcut}>⌘N 新建</kbd>
        <kbd className={styles.shortcut}>⌘, 设置</kbd>
      </div>
    </footer>
  );
}
