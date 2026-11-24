import { useCallback } from "react";

import type { RecordUsageInput } from "../ipc/types";
import { useAppStore } from "../stores/appStore";
import { usePromptStore } from "../stores/promptStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useToastStore } from "../stores/toastStore";

import { countPaste, type TrialView } from "../utils/viewTrial";

import { writeClipboard } from "./useClipboard";

// ADR-034 trial: which view a paste came from. Websites never copy a prompt.
const TRIAL_VIEW: Record<string, TrialView | undefined> = {
  quick: "quick",
  panorama: "panorama",
  skills: "skills",
  prompts: "manage",
};

// Single entry point used by every clickable asset. Order matters:
//   1. write clipboard first so the user gets the literal value even if the
//      record_usage IPC fails; if the clipboard write itself fails, surface an
//      error toast and abort — recording usage for a copy that never happened
//      would corrupt recents/today-count;
//   2. show flash + toast immediately so the feedback overlaps with the
//      200ms server-side delay before window.hide();
//   3. record_usage runs last; failure surfaces in console but does not block.
// The returned function is wrapped in useCallback so callers can safely put it
// in useEffect deps without tearing down document-level keydown listeners on
// every keystroke (see App.tsx ⌘1-9 and SearchOverlay ↑↓⏎ effects).
export function useCopy() {
  const recordCopy = usePromptStore((s) => s.recordCopy);
  const showToast = useToastStore((s) => s.show);
  // Hide suppression is global at the mode level (D-0): every copy in 整理态
  // keeps the window, regardless of which region issued it. Read via getState in
  // the callback so a mode toggle doesn't tear down callers' keydown effects.
  return useCallback(
    async function copy(
      content: string,
      input: RecordUsageInput,
      flashId?: string,
    ): Promise<void> {
      try {
        await writeClipboard(content);
      } catch (err) {
        console.error("writeClipboard failed", err);
        // No flash target on failure — the card flash signals success only.
        showToast("复制失败", undefined, "error");
        return;
      }
      showToast("已复制", flashId);
      const view = TRIAL_VIEW[useAppStore.getState().workspace];
      if (view) countPaste(view);
      const suppressHide =
        useSettingsStore.getState().interactionMode === "organize";
      try {
        await recordCopy(input, suppressHide);
      } catch (err) {
        console.error("recordCopy failed", err);
      }
    },
    [recordCopy, showToast],
  );
}
