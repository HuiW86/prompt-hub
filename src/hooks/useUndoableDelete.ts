import { useCallback } from "react";

import type { AssetKind } from "../ipc";
import { usePromptStore } from "../stores/promptStore";
import { useToastStore } from "../stores/toastStore";
import { toUserMessage } from "../utils/errorMessage";

export interface UndoableDeleteTarget {
  kind: AssetKind;
  id: string;
  /** The asset's own name, quoted into the toast so the user sees WHAT went. */
  name: string;
  /** Type word for assets whose name alone is ambiguous ("场景" / "子阶段"). */
  noun?: string;
}

// ADR-028 子决策 3: the six inline「永久删除？」confirms are gone, because delete
// is reversible now and ADR-025 `:125` already ratified 「撤销优于确认，但仅限
// 真正可逆的动作」. A confirm costs two clicks EVERY time to guard a mistake made
// once, and one that appears daily decays into muscle memory; an undo costs
// nothing until it is needed and does not depend on the user staying alert
// before acting.
//
// Callers keep their own delete call (each has its own error wording, focus
// restoration and local state to unwind) and hand the aftermath here, so the six
// sites cannot drift apart on phrasing or on how a failed 撤销 is surfaced. This
// generalises the shape draft discard has used since D-5 (DraftInbox).
export function useUndoableDelete(): (target: UndoableDeleteTarget) => void {
  const restoreAsset = usePromptStore((s) => s.restoreAsset);
  const syncRecentUsage = usePromptStore((s) => s.syncRecentUsage);
  const showToast = useToastStore((s) => s.show);
  const showWithAction = useToastStore((s) => s.showWithAction);
  const showError = useToastStore((s) => s.showError);

  return useCallback(
    ({ kind, id, name, noun = "" }: UndoableDeleteTarget) => {
      // The Recent list resolves each usage row against its asset, so a delete
      // silently changes what belongs there (ADR-028 子决策 5). The store's
      // delete actions patch only their own collection, so the re-pull is done
      // here, where every one of the six sites already funnels its aftermath.
      // Detached and failure-tolerant: a stale Recent list must never turn a
      // successful delete into an error the user has to read.
      void syncRecentUsage().catch(() => {});
      showWithAction(`已删除${noun}「${name}」`, {
        label: "撤销",
        onClick: () => {
          // The Toast component clears itself right after this returns, so the
          // restore runs detached — its own result gets its own toast, and a
          // rejected restore must never be swallowed into a silent no-op that
          // looks exactly like a successful one.
          void (async () => {
            try {
              await restoreAsset(kind, id);
              showToast(`已恢复${noun}「${name}」`);
            } catch (err) {
              showError(toUserMessage(err, "撤销失败"));
            }
          })();
        },
      });
    },
    [restoreAsset, syncRecentUsage, showToast, showWithAction, showError],
  );
}
