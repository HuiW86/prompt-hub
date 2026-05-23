import { usePromptStore } from "../stores/promptStore";

import styles from "./StatusBar.module.css";

export function StatusBar() {
  const todayCount = usePromptStore((s) => s.recentUsage.length);

  return (
    <footer
      className={styles.statusBar}
      aria-label="状态栏"
      data-region="status-bar"
    >
      <div className={styles.left}>
        <span>今日复制 {todayCount} 次</span>
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
