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
  /** Called by the wake listener; exposed for tests. */
  setSessionStartedAt: (at: string) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionStartedAt: new Date().toISOString(),
  setSessionStartedAt: (at) => set({ sessionStartedAt: at }),
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
