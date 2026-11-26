import { Layers, Settings } from "lucide-react";

import { useSegmentThumb } from "../hooks/useSegmentThumb";
import { prefetchWorkspace } from "../layouts/workspacePanels";
import { useAppStore, type Workspace } from "../stores/appStore";
import { useSearchStore } from "../stores/searchStore";
import { useSettingsStore } from "../stores/settingsStore";

import { ModeToggle } from "./ModeToggle";
import { SearchBar } from "./SearchBar";
import styles from "./Header.module.css";

// ADR-031: 全景 first — it is where every wake lands. The original dashboard is
// renamed 管理: it is where items are added, edited and moved, not where they
// are fetched. Not 整理 — that word already names the interaction mode in the
// ModeToggle beside this nav (D-0 整理态), and the two sat side by side.
const WORKSPACES: ReadonlyArray<{ id: Workspace; label: string }> = [
  { id: "panorama", label: "全景" },
  // ADR-033: next to 全景 because it is the same act — fetch, not organize.
  { id: "skills", label: "技能" },
  { id: "prompts", label: "管理" },
  { id: "websites", label: "常用网站" },
];

// Slim app header absorbed from the Promptscape design (logo + title + search +
// gear). spec §8.2 is single-user with no account, so the design's avatar is
// dropped and the title keeps the project name (no rename to Promptscape).
export function Header() {
  const workspace = useAppStore((s) => s.workspace);
  const setWorkspace = useAppStore((s) => s.setWorkspace);
  const openSettings = useSettingsStore((s) => s.openSettings);
  const navRef = useSegmentThumb<HTMLElement>(workspace);

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.logo} aria-hidden>
          <Layers size={16} strokeWidth={2} />
        </span>
        <span className={styles.title}>prompt-hub</span>
      </div>
      <nav ref={navRef} className={styles.workspaces} aria-label="工作区">
        {WORKSPACES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={workspace === id ? styles.current : styles.workspace}
            aria-current={workspace === id ? "page" : undefined}
            data-segment-active={workspace === id ? "true" : undefined}
            // Warm the lazy panel while the pointer is on its way, so the
            // switch lands on the panel, not on a 「加载中…」 frame.
            onPointerEnter={() => prefetchWorkspace(id)}
            onFocus={() => prefetchWorkspace(id)}
            onClick={() => {
              // The organize search overlay must not survive into a workspace
              // that has no search bar to dismiss it from.
              if (id !== "prompts") useSearchStore.getState().clearQuery();
              // Only a user's own switch fades the new view in; the wake path
              // (App.tsx) calls setWorkspace plainly and stays instant (C1).
              setWorkspace(id, { animate: id !== workspace });
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
