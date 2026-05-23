import type { RecordUsageInput } from "../ipc/types";
import { usePromptStore } from "../stores/promptStore";
import { useToastStore } from "../stores/toastStore";

import { writeClipboard } from "./useClipboard";

// Single entry point used by every clickable asset. Order matters:
//   1. write clipboard first so the user gets the literal value even if the
//      record_usage IPC fails;
//   2. show flash + toast immediately so the feedback overlaps with the
//      200ms server-side delay before window.hide();
//   3. record_usage runs last; failure surfaces in console but does not block.
export function useCopy() {
  const recordCopy = usePromptStore((s) => s.recordCopy);
  const showToast = useToastStore((s) => s.show);

  return async function copy(
    content: string,
    input: RecordUsageInput,
    flashId?: string,
  ): Promise<void> {
    await writeClipboard(content);
    showToast("已复制", flashId);
    try {
      await recordCopy(input);
    } catch (err) {
      console.error("recordCopy failed", err);
    }
  };
}
