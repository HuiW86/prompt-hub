import { create } from "zustand";
import { ipc } from "../ipc";
import type { WebsiteLibrary } from "../ipc/types";
import { toUserMessage } from "../utils/errorMessage";

interface WebsiteState {
  library: WebsiteLibrary;
  loaded: boolean;
  loading: boolean;
  busy: boolean;
  error: string | null;
  query: string;
  setQuery: (query: string) => void;
  refresh: () => Promise<void>;
  refreshIfLoaded: () => Promise<void>;
  mutate: (operation: () => Promise<unknown>) => Promise<void>;
}
export const useWebsiteStore = create<WebsiteState>()((set, get) => ({
  library: { groups: [], websites: [] },
  loaded: false,
  loading: false,
  busy: false,
  error: null,
  query: "",
  setQuery: (query) => set({ query }),
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      set({ library: await ipc.listWebsites(), loaded: true, loading: false });
    } catch (err) {
      set({ loading: false, error: toUserMessage(err, "网站加载失败") });
      throw err;
    }
  },
  refreshIfLoaded: async () => {
    if (get().loaded) await get().refresh();
  },
  mutate: async (operation) => {
    if (get().busy) return;
    set({ busy: true });
    try {
      await operation();
      await get().refresh();
    } finally {
      set({ busy: false });
    }
  },
}));
