import { ipc } from "../../ipc";

import type { PromptSet, RefreshHelpers } from "./types";
import { indexByPhase, indexCompositionsByPhase } from "./helpers";

// Monotonic request tickets guarding the two "await write → re-pull → set"
// refresh paths (scenes tree, drafts inbox). Mirrors the backend's copy_seq
// AtomicU64 (commands.rs record_usage): a rapid burst of mutations fires
// overlapping re-pulls, and the IPC results can resolve out of order. Each
// refresh takes a ticket on entry and only commits its snapshot if the ticket
// is still the latest one issued — so a slower earlier re-pull can no longer
// clobber a fresher later one (e.g. a just-deleted phrase reappearing). Module
// scope (not store state) keeps these counters out of React subscriptions.
//
// CRITICAL: these are SINGLE module-scoped counters shared by every writer
// (scene mutations via refreshScenes, promoteDraft's bundled re-pull via
// nextSceneTicket / isSceneTicketCurrent, drafts via refreshDraftsGuarded). Do
// NOT duplicate them per slice — the guarantee is that all scene re-pulls draw
// from one ticket sequence and all draft re-pulls from another.
let sceneRefreshSeq = 0;
let draftRefreshSeq = 0;

// promoteDraft bundles a scenes re-pull with four other slice pulls, so it needs
// to take a scene ticket manually and check it later. Expose the two operations
// rather than the raw counter so the sequence stays encapsulated here.
export function nextSceneTicket(): number {
  return ++sceneRefreshSeq;
}

export function isSceneTicketCurrent(ticket: number): boolean {
  return ticket === sceneRefreshSeq;
}

// Build the shared guarded re-pull helpers bound to this store's set. Called
// once from the store composer and threaded into every slice that mutates the
// scenes tree or the drafts inbox.
export function createRefreshHelpers(set: PromptSet): RefreshHelpers {
  // Re-pull the scenes tree with stale-result rejection. Callers await it so
  // the mutation still resolves after the refresh settles, but only the newest
  // in-flight refresh is allowed to write state.
  async function refreshScenes(): Promise<void> {
    const ticket = ++sceneRefreshSeq;
    const scenes = await ipc.listScenesWithChildren();
    if (ticket === sceneRefreshSeq) set({ scenes });
  }

  // Same monotonic guard for the drafts inbox (list + badge), shared by
  // promoteDraft / discardDraft / refreshDrafts so a rapid promote+discard
  // burst can't let an earlier count/list overwrite a later one.
  async function refreshDraftsGuarded(): Promise<void> {
    const ticket = ++draftRefreshSeq;
    const [drafts, pendingDraftCount] = await Promise.all([
      ipc.listDrafts({ status: "pending" }),
      ipc.countPendingDrafts(),
    ]);
    if (ticket === draftRefreshSeq) set({ drafts, pendingDraftCount });
  }

  return { refreshScenes, refreshDraftsGuarded };
}

// Re-export index helpers so promoteDraft's bundled re-pull (draftsSlice) can
// resolve them alongside the ticket API from one module.
export { indexByPhase, indexCompositionsByPhase };
