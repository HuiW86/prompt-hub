import { create } from "zustand";

import {
  createAlignmentSlice,
  createCompositionSlice,
  createDraftsSlice,
  createLoadSlice,
  createMacroSlice,
  createModifierSlice,
  createRecordingSlice,
  createRefreshHelpers,
  createSceneSlice,
  initialPromptState,
} from "./prompt";
import type { PromptState } from "./prompt";

// Public API surface is FROZEN: the hook name, state shape, action names, and
// exported types below are re-exported unchanged from ./prompt so every consumer
// (components, tests, other stores) resolves them exactly as before. The store
// body is now composed from slice factories in ./prompt/*; the single source of
// each field/action still lives in exactly one slice.
export type { LoadState, PromptState } from "./prompt";

export const usePromptStore = create<PromptState>()((set, get) => {
  // The scene-tree + drafts-inbox re-pulls are guarded by SINGLE module-scoped
  // monotonic counters (see ./prompt/guards.ts) so out-of-order IPC results
  // can't let a stale re-pull clobber a fresh one. Build the shared helpers once
  // and thread them into every slice that mutates those trees.
  const refresh = createRefreshHelpers(set);
  return {
    ...initialPromptState,
    ...createLoadSlice(set, get, refresh),
    ...createRecordingSlice(set, get, refresh),
    ...createDraftsSlice(set, get, refresh),
    ...createMacroSlice(set, get, refresh),
    ...createModifierSlice(set, get, refresh),
    ...createAlignmentSlice(set, get, refresh),
    ...createCompositionSlice(set, get, refresh),
    ...createSceneSlice(set, get, refresh),
  };
});
