import { useEffect } from "react";

import "./App.css";
import { ipc } from "./ipc";
import { Dashboard } from "./layouts/Dashboard";
import { usePromptStore } from "./stores/promptStore";

function App() {
  const refreshAll = usePromptStore((s) => s.refreshAll);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // React 18+ delegates synthetic events to the root container, so a
      // child's stopPropagation cannot reliably block this document-level
      // listener. Check the target directly: if focus is in the search
      // input AND it has content, let SearchBar's onKeyDown clear the
      // query and skip hiding. The next ESC (input now empty) will fall
      // through and hide as intended.
      const t = e.target;
      if (
        t instanceof HTMLInputElement &&
        t.value.length > 0 &&
        t.closest("[role='search']")
      ) {
        return;
      }
      void ipc.hideWindow();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return <Dashboard />;
}

export default App;
