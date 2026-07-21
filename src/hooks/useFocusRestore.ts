import { useCallback, useEffect, useRef } from "react";

// Focus restoration across a store re-pull (audit A1-05). A scene/sub-stage
// write goes ipc → refreshScenes() full re-pull → the list re-renders → the DOM
// node that held focus is torn down → focus falls to <body>, and useRegionNav
// (which resumes from document.activeElement) restarts at the region container.
// This hook restores focus to the right nav item after the re-pull settles.
//
// Timing contract: restoration must run AFTER the React commit that follows
// the mutation — at the moment `await mutation()` resolves the old DOM is
// usually still mounted (and still holds focus), so an immediate check would
// conclude nothing was lost and bail. The hook therefore ARMS a pending
// restore and consumes it on the next commit (effect below), with a macrotask
// fallback for the case where the commit flushed before arming.
//
// Two entry points cover the two shapes of write in this region:
//   • run(mutation, options) — the orchestrator owns an async handler that
//     internally re-pulls (reorder / delete / move). It snapshots the focused
//     nav key BEFORE the write and arms the restore once it resolves.
//   • restoreAfterRender(key) — a CHILD owns the re-pull (e.g. PhraseEditor's
//     save), so the orchestrator can't await it. The orchestrator arms a key
//     when the editor closes; once the card re-mounts, the effect lands focus.
//
// Contract with useRegionNav: restored targets carry BOTH `data-nav-id` (this
// hook's stable key) and `data-nav-item` (the roving-nav marker), so arrow
// traversal continues from the restored node instead of the container.
//
// Key format (assigned by callers via data-nav-id):
//   phrase-<id>              a phrase card
//   substage-<id>-<role>     a sub-stage header control (-rename / -delete / …)
// The key is opaque here — the hook only reads/writes the attribute value.

interface FocusRestoreOptions {
  // The nav key to restore focus to after the re-pull. Callers pass this
  // explicitly because the focused element at write time is usually an action
  // BUTTON (e.g. the 下移 arrow) whose own key isn't what should regain focus —
  // the MOVED ITEM's card should. Omit only when the focused element already
  // carries the right data-nav-id and should regain focus as-is.
  targetKey?: string;
  // Nav keys in on-screen order, so a deleted target can fall to its nearest
  // surviving sibling. Provide together with targetKey for delete paths.
  siblingKeys?: string[];
  // Extra fallback focus target when nothing matches (column header / region
  // container). Resolved lazily so a detached ref is tolerated.
  fallback?: () => HTMLElement | null;
}

interface PendingRestore {
  key: string | null;
  siblingKeys: string[];
  fallback?: () => HTMLElement | null;
  // Remaining not-yet-neutral observations before the restore expires. The
  // commit that tears the focused node down may land a tick after arming, so
  // seeing focus still on the old node must NOT cancel the restore outright —
  // but a user who moved on must not get焦点 yanked seconds later either.
  tries: number;
}

function focusByKey(root: ParentNode, key: string): HTMLElement | null {
  const el = root.querySelector<HTMLElement>(
    `[data-nav-id="${CSS.escape(key)}"]`,
  );
  if (el) {
    el.focus();
    return el;
  }
  return null;
}

export function useFocusRestore(getRoot: () => HTMLElement | null) {
  const pendingRef = useRef<PendingRestore | null>(null);
  // Self-reference so the retry path can re-queue without a TDZ cycle.
  const attemptRef = useRef<() => void>(() => {});

  // Consume the armed restore. Runs on every commit (effect) AND on a queued
  // macrotask (run's fallback); whichever fires first after the re-pull's
  // commit wins, the other is a no-op. Only steals focus back from a neutral
  // host (body / the region container) so it never fights an explicit focus
  // the user or a follow-up handler has since set.
  const attempt = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    const root = getRoot();
    const active = document.activeElement;
    const droppedToNeutral =
      active === null || active === document.body || active === root;
    if (!droppedToNeutral) {
      // Either the teardown commit hasn't flushed yet (old node still holds
      // focus) or the user genuinely moved on. Retry a few ticks, then treat
      // the restore as moot — never yank focus long after the fact.
      pending.tries -= 1;
      if (pending.tries <= 0) {
        pendingRef.current = null;
        return;
      }
      setTimeout(attemptRef.current, 0);
      return;
    }
    pendingRef.current = null;
    const scope: ParentNode = root ?? document;

    // 1) Same key still present (rename / reorder / move): land back on it.
    if (pending.key && focusByKey(scope, pending.key)) return;

    // 2) Deletion: the captured node is gone — walk to the nearest surviving
    //    sibling, next first then previous, from the removed item's slot.
    if (pending.key && pending.siblingKeys.length > 0) {
      const removedIdx = pending.siblingKeys.indexOf(pending.key);
      if (removedIdx !== -1) {
        for (let i = removedIdx + 1; i < pending.siblingKeys.length; i++) {
          if (focusByKey(scope, pending.siblingKeys[i])) return;
        }
        for (let i = removedIdx - 1; i >= 0; i--) {
          if (focusByKey(scope, pending.siblingKeys[i])) return;
        }
      }
    }

    // 3) Explicit fallback (column header / region container).
    const fallbackEl = pending.fallback?.();
    if (fallbackEl) {
      fallbackEl.focus();
      return;
    }
    // 4) Last resort: the region container so roving nav can re-enter.
    root?.focus();
  }, [getRoot]);

  const run = useCallback(
    async (
      mutation: () => Promise<void>,
      options: FocusRestoreOptions = {},
    ): Promise<void> => {
      const active = document.activeElement as HTMLElement | null;
      // Prefer the explicit target key; fall back to the focused element's own
      // key (rename controls regain focus as-is).
      const capturedKey =
        options.targetKey ?? active?.getAttribute?.("data-nav-id") ?? null;

      await mutation();

      pendingRef.current = {
        key: capturedKey,
        siblingKeys: options.siblingKeys ?? [],
        fallback: options.fallback,
        tries: 8,
      };
      // Macrotask fallback: if the re-pull's commit flushed while we were
      // awaiting (arming too late for the effect to see), this still lands
      // after that commit's teardown and performs the restore.
      setTimeout(attempt, 0);
    },
    [attempt],
  );

  // Arm a key to focus after the next render commit — for writes a child owns
  // (the orchestrator can't await them, so it schedules the restore instead).
  const restoreAfterRender = useCallback(
    (key: string) => {
      pendingRef.current = { key, siblingKeys: [], tries: 8 };
      setTimeout(attempt, 0);
    },
    [attempt],
  );

  // Keep the retry path pointed at the latest attempt closure.
  useEffect(() => {
    attemptRef.current = attempt;
  }, [attempt]);

  // Post-commit consumer: no-op unless a restore is armed.
  useEffect(() => {
    attempt();
  });

  return { run, restoreAfterRender };
}
