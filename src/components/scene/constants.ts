import type { Phrase } from "../../ipc/types";

// Sentinel id for the synthetic ungrouped bucket in per-column UI state
// (rename/promote) and the sub-stage <select> "未分组" option. It never collides
// with backend UUIDs. Kept as a single shared literal so the grid's UI-state key
// and the editors' select value can never drift apart.
export const UNGROUPED_KEY = "__ungrouped__";

export type EditTarget =
  | { mode: "create" }
  | { mode: "edit"; phrase: Phrase }
  | null;
