import { Layers, Settings } from "lucide-react";

import { useAppStore } from "../stores/appStore";
import { useSearchStore } from "../stores/searchStore";
import { useSettingsStore } from "../stores/settingsStore";

import { ModeToggle } from "./ModeToggle";
import { SearchBar } from "./SearchBar";
import styles from "./Header.module.css";

// Slim app header absorbed from the Promptscape design (logo + title + search +
// gear). spec §8.2 is single-user with no account, so the design's avatar is
// dropped and the title keeps the project name (no rename to Promptscape).
export function Header() {
  const workspace = useAppStore((s) => s.workspace);
  const setWorkspace = useAppStore((s) => s.setWorkspace);
  const openSettings = useSettingsStore((s) => s.openSettings);

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.logo} aria-hidden>
          <Layers size={16} strokeWidth={2} />
        </span>
        <span className={styles.title}>prompt-hub</span>
      </div>
      <nav className={styles.workspaces} aria-label="工作区">
        <button
          type="button"
          className={
            workspace === "prompts" ? styles.current : styles.workspace
          }
          aria-current={workspace === "prompts" ? "page" : undefined}
          onClick={() => setWorkspace("prompts")}
        >
          提示词
        </button>
        <button
          type="button"
          className={
            workspace === "websites" ? styles.current : styles.workspace
          }
          aria-current={workspace === "websites" ? "page" : undefined}
          onClick={() => {
            useSearchStore.getState().clearQuery();
            setWorkspace("websites");
          }}
        >
          常用网站
        </button>
      </nav>
      {workspace === "prompts" ? (
        <>
          <SearchBar />
          <ModeToggle />
        </>
      ) : (
        <div className={styles.spacer} />
      )}
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
