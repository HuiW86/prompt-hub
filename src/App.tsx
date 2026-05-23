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
      // Search field swallows ESC first (clears query) — handled in SearchBar
      // via stopPropagation. Bubble reaching here means no field consumed it.
      void ipc.hideWindow();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return <Dashboard />;
}

export default App;
