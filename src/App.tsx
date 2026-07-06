import { useEffect } from "react";

import "./App.css";
import { usePhaseSelect } from "./hooks/usePhaseSelect";
import { ipc } from "./ipc";
import { Dashboard } from "./layouts/Dashboard";
import { usePromptStore } from "./stores/promptStore";
import { selectIsSearching, useSearchStore } from "./stores/searchStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useUpdaterStore } from "./stores/updaterStore";
import { isPrimaryModifier } from "./utils/platform";

function App() {
  const refreshAll = usePromptStore((s) => s.refreshAll);
  const selectPhase = usePhaseSelect();

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  // Auto-update check (ADR-017 §5.2): runs once at startup, off the ⌥Space wake
  // hot path (that path is the Rust global-shortcut handler — untouched here),
  // so it never threatens the C1 200ms budget. Gated on the opt-in total switch
  // — when disabled, check() short-circuits before any network egress (§5.3).
  useEffect(() => {
    // Dev builds have no signed release endpoint, so an auto check() always
    // fails — pointless work at startup. Gate on PROD; the manual "检查更新"
    // button still exercises the failure path. Auto-check failures are silent
    // by design (updaterStore keeps status off "error" for non-manual checks)
    // so an offline release launch never grows a persistent failure banner.
    if (!import.meta.env.PROD) return;
    const { enabled, optInDecided, check } = useUpdaterStore.getState();
    if (enabled && optInDecided) void check();
  }, []);

  // ⌘/Ctrl , opens the settings dialog (absorbed from the Promptscape design).
  // Off the wake hot path; toggles transient settingsStore.settingsOpen only.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!isPrimaryModifier(e) || e.shiftKey || e.altKey || e.key !== ",") {
        return;
      }
      e.preventDefault();
      useSettingsStore.getState().openSettings();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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

  // Wake hygiene (A2-5 walkthrough defect): the Rust side hides the window
  // ~200ms after a copy, but nothing clears the search query on the way out, so
  // the SearchOverlay stays mounted and the next ⌥Space wake lands on the
  // overlay instead of the panoramic dashboard (violates 哲学二「默认视图是全景
  // 式」). We key off `visibilitychange`→hidden — the symmetric counterpart to
  // SearchBar's →visible wake signal (03-product-spec §13.4) — because the Rust
  // side sends no custom hide event and window visibility is the stable signal.
  //
  // Two things happen on hide:
  //   1. clearQuery() drops the query (and resets selectedIndex, searchStore.ts)
  //      so the overlay unmounts and the next wake shows the full dashboard.
  //   2. Focus归位: after an Enter-copy the focus rests on a result row; blur it
  //      so activeElement returns to <body>, which lets SearchBar's wake-focus
  //      guard (only grabs focus when activeElement is body) re-focus the input
  //      on the next wake — extending "唤起即聚焦" to the copy-then-rewake path.
  //      Text-input类元素 (INPUT/TEXTAREA/SELECT/contenteditable) are exempt: a
  //      user who hid the window mid-edit expects the caret preserved on return.
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState !== "hidden") return;
      useSearchStore.getState().clearQuery();
      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body) return;
      const tag = active.tagName;
      const isTextEntry =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        active.isContentEditable;
      if (isTextEntry) return;
      active.blur();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return <Dashboard />;
}

export default App;
