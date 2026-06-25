import { Layers, Settings } from "lucide-react";

import { useSettingsStore } from "../stores/settingsStore";

import { SearchBar } from "./SearchBar";
import styles from "./Header.module.css";

// Slim app header absorbed from the Promptscape design (logo + title + search +
// gear). spec §8.2 is single-user with no account, so the design's avatar is
// dropped and the title keeps the project name (no rename to Promptscape).
export function Header() {
  const openSettings = useSettingsStore((s) => s.openSettings);

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.logo} aria-hidden>
          <Layers size={16} strokeWidth={2} />
        </span>
        <span className={styles.titles}>
          <span className={styles.title}>prompt-hub</span>
          <span className={styles.subtitle}>提示词资产 · 全景仪表盘</span>
        </span>
      </div>
      <SearchBar />
      <button
        type="button"
        className={styles.gear}
        aria-label="设置"
        title="设置 (⌘,)"
        onClick={openSettings}
      >
        <Settings size={16} strokeWidth={2} aria-hidden />
      </button>
    </header>
  );
}
