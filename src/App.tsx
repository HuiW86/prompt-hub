import { useEffect } from "react";

import "./App.css";
import { usePhaseSelect } from "./hooks/usePhaseSelect";
import { ipc } from "./ipc";
import { Dashboard } from "./layouts/Dashboard";
import { usePromptStore } from "./stores/promptStore";
import { selectIsSearching, useSearchStore } from "./stores/searchStore";
import { useSettingsStore } from "./stores/settingsStore";
import { isPrimaryModifier } from "./utils/platform";

function App() {
  const refreshAll = usePromptStore((s) => s.refreshAll);
  const selectPhase = usePhaseSelect();

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // ESC routing: when the search overlay is up (isSearching = query has
      // content), SearchOverlay's document keydown listener will clear the
      // query and "exit search". App's job is only to hide the window when
      // nothing else is on screen to consume ESC. This relies on Zustand's
      // synchronous setState so the check sees the live state; React's
      // synthetic event delegation is irrelevant here.
      if (selectIsSearching(useSearchStore.getState())) return;
      void ipc.hideWindow();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Document-level keydown ordering across the app (mount order):
      //   1. App ESC (this file, earlier effect) — falls through if focus is
      //      in SearchBar with a non-empty value; SearchOverlay now also
      //      intercepts Escape to clear the query when it owns the screen.
      //   2. App ⌘/Ctrl 1-8 (here) — phase switch + AlignmentPhrase copy.
      //   3. SearchBar ⌘/Ctrl K — focus + select the input.
      //   4. SearchOverlay ↑↓⏎ — only active while isSearching.
      // All later listeners early-return on non-matching modifiers so the
      // ordering does not produce double-fires.
      if (
        !isPrimaryModifier(e) ||
        e.shiftKey ||
        e.altKey ||
        !/^[1-8]$/.test(e.key)
      ) {
        return;
      }
      // Walk the visible phase list (after hiddenPhaseIds filter) so ⌘N maps
      // 1:1 to the keycap shown in PhaseBar — otherwise ⌘1 could land on a
      // hidden phase.
      const phases = usePromptStore.getState().phases;
      const hidden = useSettingsStore.getState().hiddenPhaseIds;
      const visible = phases.filter((p) => !hidden.includes(p.id));
      const idx = Number(e.key) - 1;
      if (idx >= visible.length) return;
      e.preventDefault();
      selectPhase(visible[idx].id);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectPhase]);

  return <Dashboard />;
}

export default App;
