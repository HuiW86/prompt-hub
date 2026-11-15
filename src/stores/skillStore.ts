import { create } from "zustand";

import { ipc } from "../ipc";
import type { Skill, SkillImportSummary } from "../ipc/types";
import { toUserMessage } from "../utils/errorMessage";

// The skill board's data (ADR-033). `skills` mirrors the `skills` table plus
// the usage figures the backend derives; every write replaces it with the
// full list, so a displaced pin holder can never linger here. `query` and
// `selectedId` are view state kept in a store because App's Esc handler must
// see the query and a wake must be able to clear both.

interface SkillState {
  skills: Skill[];
  loaded: boolean;
  error: string | null;
  query: string;
  selectedId: string | null;
  load: () => Promise<void>;
  importIndex: (path: string) => Promise<SkillImportSummary>;
  /** Log one use. The local count moves at once; the next load reconciles. */
  recordUse: (id: string, suppressHide: boolean) => Promise<void>;
  setPin: (id: string, pinSlot: number | null) => Promise<Skill[]>;
  setQuery: (query: string) => void;
  select: (id: string | null) => void;
  resetView: () => void;
}

export const useSkillStore = create<SkillState>()((set) => ({
  skills: [],
  loaded: false,
  error: null,
  query: "",
  selectedId: null,
  load: async () => {
    try {
      set({ skills: await ipc.listSkills(), loaded: true, error: null });
    } catch (err) {
      set({ loaded: true, error: toUserMessage(err, "技能加载失败") });
    }
  },
  importIndex: async (path) => {
    const summary = await ipc.importSkillIndex(path);
    set({ skills: await ipc.listSkills(), loaded: true, error: null });
    return summary;
  },
  recordUse: async (id, suppressHide) => {
    const now = new Date().toISOString();
    set((s) => ({
      skills: s.skills.map((k) =>
        k.id === id
          ? { ...k, usageCount: k.usageCount + 1, lastUsedAt: now }
          : k,
      ),
    }));
    await ipc.recordSkillUse(id, suppressHide);
  },
  setPin: async (id, pinSlot) => {
    const skills = await ipc.setSkillPin(id, pinSlot);
    set({ skills });
    return skills;
  },
  setQuery: (query) => set({ query }),
  select: (selectedId) => set({ selectedId }),
  resetView: () => set({ query: "", selectedId: null }),
}));
