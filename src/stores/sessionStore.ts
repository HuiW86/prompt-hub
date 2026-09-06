import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { create } from "zustand";

// The wake session boundary (ADR-029 子决策 4 / HANDOFF 21.1).
//
// Rust emits a `wake` event carrying an RFC 3339 timestamp every time the
// overlay is shown — the global chord and the macOS Dock reopen both go through
// the same path — and every usage record written until the next wake is stamped
// with that value. Grouping records by it is the whole definition of a session:
// there is no session table, because a session here has no attributes beyond
// "when did it start".
//
// NOT persisted. A session is by definition this summon and no other, so
// restoring one from localStorage would glue two wakes into a single group and
// make the ledger claim a cue followed an opening phrase copied yesterday.
//
// The initial value is the moment this module loads rather than null. A window
// that has been open since `pnpm tauri dev` started has never received a wake,
// and records made in it would otherwise carry no session at all — invisible to
// the ledger for a reason that has nothing to do with how the app was used.

interface WakePayload {
  sessionStartedAt?: string;
}

interface SessionState {
  sessionStartedAt: string;
  /**
   * Live cues copied since the current wake began — the number the status bar
   * cell reads (03-product-spec 区域 7 「范围是本次唤起会话，不是今日」).
   *
   * Kept HERE rather than derived from `summarize_drift_ledger`, which is
   * cross-session by construction: the ledger answers "over all wakes", and no
   * argument narrows it to this one. A counter that lives beside the session
   * stamp cannot disagree with the stamp about which wake it is in.
   */
  liveCueCount: number;
  /** Called by the wake listener; exposed for tests. */
  setSessionStartedAt: (at: string) => void;
  /** Called by the ipc layer after a `live_cue` record lands. */
  noteLiveCue: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionStartedAt: new Date().toISOString(),
  liveCueCount: 0,
  // A wake IS a new session, so the count starts over with it. The two fields
  // are written in one set() for that reason: leaving the counter behind would
  // let the cell report cues from a summon that has already ended.
  setSessionStartedAt: (at) => set({ sessionStartedAt: at, liveCueCount: 0 }),
  noteLiveCue: () => set((s) => ({ liveCueCount: s.liveCueCount + 1 })),
}));

/**
 * Subscribe to the `wake` event. Called once at App mount; the returned
 * unlisten runs on unmount.
 *
 * Failure is swallowed on purpose. Outside a Tauri host (a jsdom test, a plain
 * `vite dev` browser tab) there is no event bus to attach to, and the store
 * keeps its load-time timestamp — every record still carries a session, it is
 * just one long one. Losing the subscription costs attribution precision, never
 * the copy itself.
 */
export async function startWakeListener(): Promise<UnlistenFn> {
  try {
    return await listen<WakePayload>("wake", (event) => {
      const at = event.payload?.sessionStartedAt;
      if (typeof at === "string" && at.length > 0) {
        useSessionStore.getState().setSessionStartedAt(at);
      }
    });
  } catch {
    return () => {};
  }
}

/** The session stamp the ipc layer puts on every usage record. */
export function currentSessionStartedAt(): string {
  return useSessionStore.getState().sessionStartedAt;
}

/**
 * Count one live cue against the current wake. Called from the ipc layer once
 * the write has landed, so the cell never counts a copy the database refused.
 */
export function noteLiveCue(): void {
  useSessionStore.getState().noteLiveCue();
}
