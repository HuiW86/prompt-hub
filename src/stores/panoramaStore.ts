import { create } from "zustand";

import { ipc } from "../ipc";
import type { PanoramaPlacement } from "../ipc/types";

// Panorama layout + view state (I-03 / ADR-031).
//
// `placements` mirrors the `panorama_placements` table; every write replaces it
// with the full list the backend returns, so a displaced pin holder can never
// linger here with a stale slot. `query` and `selectedKey` are view state that
// lives in a store (not component state) because App's Esc handler must see
// the query, and a wake must be able to clear both.

/** `${kind}:${id}` — unique across the five asset kinds. */
export type PanoramaItemKey = string;

interface PanoramaState {
  placements: PanoramaPlacement[];
  loaded: boolean;
  query: string;
  selectedKey: PanoramaItemKey | null;
  load: () => Promise<void>;
  setPlacement: (input: PanoramaPlacement) => Promise<PanoramaPlacement[]>;
  setQuery: (query: string) => void;
  select: (key: PanoramaItemKey | null) => void;
  /** Wake hygiene: every summon starts from an empty filter, nothing selected. */
  resetView: () => void;
}

export function panoramaKey(kind: string, id: string): PanoramaItemKey {
  return `${kind}:${id}`;
}

export const usePanoramaStore = create<PanoramaState>()((set) => ({
  placements: [],
  loaded: false,
  query: "",
  selectedKey: null,
  load: async () => {
    try {
      const placements = await ipc.listPanoramaPlacements();
      set({ placements, loaded: true });
    } catch (err) {
      // Layout is an enhancement over the default rule, never a gate: without
      // it every item still shows, in its default column with no pin.
      console.error("listPanoramaPlacements failed", err);
      set({ loaded: true });
    }
  },
  setPlacement: async (input) => {
    const placements = await ipc.setPanoramaPlacement(input);
    set({ placements });
    return placements;
  },
  setQuery: (query) => set({ query }),
  select: (selectedKey) => set({ selectedKey }),
  resetView: () => set({ query: "", selectedKey: null }),
}));
