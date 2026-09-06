import { ipc } from "../../ipc";
import type { AlignmentPhrase } from "../../ipc/types";

import type { PromptState, StateCreatorSlice } from "./types";

export const createAlignmentSlice: StateCreatorSlice<
  Pick<
    PromptState,
    | "createAlignmentPhrase"
    | "updateAlignmentPhrase"
    | "deleteAlignmentPhrase"
    | "reorderAlignmentPhrases"
    | "setDefaultAlignmentPhrase"
  >
> = (set, get) => ({
  createAlignmentPhrase: async ({ phaseId, name, content, coordinates }) => {
    const created = await ipc.createAlignmentPhrase({
      phaseId,
      name,
      content,
      coordinates,
    });
    set((state) => ({
      alignmentPhrasesByPhase: {
        ...state.alignmentPhrasesByPhase,
        [created.phaseId]: [
          ...(state.alignmentPhrasesByPhase[created.phaseId] ?? []),
          created,
        ],
      },
    }));
  },

  // The optimistic patch mirrors exactly what the backend writes: with
  // `coordinates` omitted the five classification fields are left alone, so the
  // patch must leave them alone too. `contentRevisedAt` is deliberately NOT
  // touched here — the backend stamps it only when `content` actually changed,
  // and guessing at that client-side would move the drift ledger's split point
  // on a rename (06-prd §6.6).
  updateAlignmentPhrase: async ({ id, name, content, coordinates }) => {
    const snapshot = get().alignmentPhrasesByPhase;
    const next: Record<string, AlignmentPhrase[]> = {};
    for (const [phaseId, list] of Object.entries(snapshot)) {
      next[phaseId] = list.map((a) =>
        a.id === id ? { ...a, name, content, ...(coordinates ?? {}) } : a,
      );
    }
    set({ alignmentPhrasesByPhase: next });
    try {
      await ipc.updateAlignmentPhrase({ id, name, content, coordinates });
    } catch (err) {
      set({ alignmentPhrasesByPhase: snapshot });
      throw err;
    }
  },

  deleteAlignmentPhrase: async (id) => {
    const snapshot = get().alignmentPhrasesByPhase;
    const next: Record<string, AlignmentPhrase[]> = {};
    for (const [phaseId, list] of Object.entries(snapshot)) {
      next[phaseId] = list.filter((a) => a.id !== id);
    }
    set({ alignmentPhrasesByPhase: next });
    try {
      await ipc.deleteAlignmentPhrase(id);
    } catch (err) {
      set({ alignmentPhrasesByPhase: snapshot });
      throw err;
    }
  },

  // Reorder is scoped to one phase bucket: only the targeted phase's members are
  // resequenced (per orderedIds); other phases keep their place.
  reorderAlignmentPhrases: async (phaseId, orderedIds) => {
    const snapshot = get().alignmentPhrasesByPhase;
    const byId = new Map(
      (snapshot[phaseId] ?? []).map((a) => [a.id, a] as const),
    );
    const reordered = orderedIds
      .map((id) => byId.get(id))
      .filter((a): a is AlignmentPhrase => a !== undefined);
    set({
      alignmentPhrasesByPhase: { ...snapshot, [phaseId]: reordered },
    });
    try {
      await ipc.reorderAlignmentPhrases(phaseId, orderedIds);
    } catch (err) {
      set({ alignmentPhrasesByPhase: snapshot });
      throw err;
    }
  },

  setDefaultAlignmentPhrase: async (phaseId, id) => {
    const phrasesSnapshot = get().alignmentPhrasesByPhase;
    const phasesSnapshot = get().phases;
    set({
      alignmentPhrasesByPhase: {
        ...phrasesSnapshot,
        [phaseId]: (phrasesSnapshot[phaseId] ?? []).map((a) => ({
          ...a,
          isDefault: a.id === id,
        })),
      },
      phases: phasesSnapshot.map((p) =>
        p.id === phaseId ? { ...p, defaultAlignmentPhraseId: id } : p,
      ),
    });
    try {
      await ipc.setDefaultAlignmentPhrase({ phaseId, id });
    } catch (err) {
      set({
        alignmentPhrasesByPhase: phrasesSnapshot,
        phases: phasesSnapshot,
      });
      throw err;
    }
  },
});
