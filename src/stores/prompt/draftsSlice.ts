import { ipc } from "../../ipc";

import { indexByPhase, isSceneTicketCurrent, nextSceneTicket } from "./guards";
import { draftPreview, indexCompositionsByPhase } from "./helpers";
import type { PromptState, StateCreatorSlice } from "./types";

export const createDraftsSlice: StateCreatorSlice<
  Pick<
    PromptState,
    | "refreshDrafts"
    | "promoteDraft"
    | "updateDraft"
    | "discardDraft"
    | "restoreDraft"
  >
> = (set, get, { refreshDraftsGuarded }) => ({
  refreshDrafts: async () => {
    await refreshDraftsGuarded();
  },

  promoteDraft: async ({ id, groupKind }) => {
    const result = await ipc.promoteDraft({ id, groupKind });
    // The draft left the inbox and a new asset landed in one of the four real
    // tables. Refresh the inbox (list + badge) and silently re-pull the asset
    // slices so the promoted item shows on this summon without a loadState flash.
    // Take a scene ticket so this bundled re-pull participates in the same
    // stale-result guard as refreshScenes — a concurrent scene mutation's pull
    // resolving later must win over this one, and vice versa.
    const sceneTicket = nextSceneTicket();
    const [macros, modifiers, scenes, alignments, compositions] =
      await Promise.all([
        ipc.listMacros(),
        ipc.listModifiers(),
        ipc.listScenesWithChildren(),
        ipc.listAlignmentPhrases(),
        ipc.listCompositions(),
      ]);
    const alignmentPhrasesByPhase = indexByPhase(alignments);
    set({
      macros,
      modifiers,
      alignmentPhrasesByPhase,
      compositionsByPhase: indexCompositionsByPhase(compositions),
      // Only overwrite scenes if no newer scene re-pull has been issued since.
      ...(isSceneTicketCurrent(sceneTicket) ? { scenes } : {}),
    });
    await get().refreshDrafts();
    // Locate the phase the landed asset belongs to (phase-scoped assets render
    // only under their active phase). Confined to the store so no task-layer
    // component reads the protocol-layer slice directly (B2).
    let phaseId: string | null = null;
    for (const [pid, list] of Object.entries(alignmentPhrasesByPhase)) {
      if (list.some((a) => a.id === result.insertedAssetId)) {
        phaseId = pid;
        break;
      }
    }
    // Hand the new asset's id + type (+ landed phase) back for the flash (A1-03).
    return { ...result, phaseId };
  },

  // Optimistic like updateMacro: re-derive the card's name/preview from the new
  // payload immediately, roll back to the snapshot if the IPC rejects (payload
  // too large, draft no longer pending, schema drift...) and rethrow for toasts.
  updateDraft: async ({ id, payload }) => {
    const snapshot = get().drafts;
    set({
      drafts: snapshot.map((d) =>
        d.id === id
          ? { ...d, name: payload.name, preview: draftPreview(payload) }
          : d,
      ),
    });
    try {
      await ipc.updateDraft(id, payload);
    } catch (err) {
      set({ drafts: snapshot });
      throw err;
    }
  },

  discardDraft: async (id) => {
    await ipc.discardDraft(id);
    await get().refreshDrafts();
  },

  restoreDraft: async (id) => {
    await ipc.restoreDraft(id);
    await get().refreshDrafts();
  },
});
