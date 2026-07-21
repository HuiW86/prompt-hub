import { ipc } from "../../ipc";

import { RECENT_LIMIT, bumpUsageCount } from "./helpers";
import type { PromptState, StateCreatorSlice } from "./types";

export const createRecordingSlice: StateCreatorSlice<
  Pick<PromptState, "recordCopy">
> = (set) => ({
  recordCopy: async (input, suppressHide) => {
    const record = await ipc.recordUsage(input, suppressHide);
    set((state) =>
      bumpUsageCount(state, input.targetType, input.targetId, record.timestamp),
    );
    // Refresh recent list + today count in parallel so the new copy lands at
    // the top of recents with target_name JOINed AND the StatusBar increments
    // in lockstep. Both are bounded queries — cheap.
    const [recent, todayCount] = await Promise.all([
      ipc.listRecentUsage(RECENT_LIMIT),
      ipc.countTodayUsage(),
    ]);
    set({ recentUsage: recent, todayCount });
  },
});
