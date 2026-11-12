import { Layers, Settings } from "lucide-react";

import { useAppStore, type Workspace } from "../stores/appStore";
import { useSearchStore } from "../stores/searchStore";
import { useSettingsStore } from "../stores/settingsStore";

import { ModeToggle } from "./ModeToggle";
import { SearchBar } from "./SearchBar";
import styles from "./Header.module.css";

// ADR-031: 全景 first — it is where every wake lands. The original dashboard is
// renamed 整理: it is where items are edited, not where they are fetched.
const WORKSPACES: ReadonlyArray<{ id: Workspace; label: string }> = [
  { id: "panorama", label: "全景" },
  { id: "prompts", label: "整理" },
  { id: "websites", label: "常用网站" },
];

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
        {WORKSPACES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={workspace === id ? styles.current : styles.workspace}
            aria-current={workspace === id ? "page" : undefined}
            onClick={() => {
              // The organize search overlay must not survive into a workspace
              // that has no search bar to dismiss it from.
              if (id !== "prompts") useSearchStore.getState().clearQuery();
              setWorkspace(id);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {workspace === "prompts" ? (
        <SearchBar />
      ) : (
        <div className={styles.spacer} />
      )}
      {/* The mode switch matters in the panorama too: organize mode is where
          its placement controls live (I-04). */}
      {workspace !== "websites" && <ModeToggle />}
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
