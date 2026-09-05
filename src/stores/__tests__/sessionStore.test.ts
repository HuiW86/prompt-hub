import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecordUsageInput } from "../../ipc/types";

// Both Tauri surfaces are mocked BEFORE the modules under test are imported:
// `sessionStore` captures `listen` and `ipc` captures `invoke` at module load.
const listenMock = vi.fn();
const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { ipc } from "../../ipc";
import {
  currentSessionStartedAt,
  startWakeListener,
  useSessionStore,
} from "../sessionStore";

type WakeHandler = (event: { payload: { sessionStartedAt?: string } }) => void;

const RECORD: RecordUsageInput = {
  targetType: "alignment",
  targetId: "ap-live-stop",
  source: "live_cue",
  modifierIds: null,
  sopId: null,
  sopStepOrder: null,
  phaseId: "phase-live",
};

describe("sessionStore — the wake boundary the drift ledger groups by", () => {
  beforeEach(() => {
    listenMock.mockReset();
    invokeMock.mockReset();
    useSessionStore.setState({ sessionStartedAt: new Date().toISOString() });
  });

  // A dev window that has been open since `pnpm tauri dev` started has never
  // received a wake. Starting from null would leave every record it produces
  // with no session at all — invisible to the ledger for a reason that has
  // nothing to do with how the app was used.
  it("starts from a real timestamp rather than null", () => {
    const at = currentSessionStartedAt();
    expect(at).toBeTruthy();
    expect(Number.isNaN(Date.parse(at))).toBe(false);
  });

  it("adopts the timestamp carried by a wake event", async () => {
    let handler: WakeHandler | undefined;
    listenMock.mockImplementation((_name: string, cb: WakeHandler) => {
      handler = cb;
      return Promise.resolve(() => {});
    });

    await startWakeListener();
    expect(listenMock).toHaveBeenCalledWith("wake", expect.any(Function));

    handler?.({ payload: { sessionStartedAt: "2026-09-05T09:00:00+00:00" } });
    expect(currentSessionStartedAt()).toBe("2026-09-05T09:00:00+00:00");
  });

  it("ignores a malformed payload instead of clearing the current session", async () => {
    let handler: WakeHandler | undefined;
    listenMock.mockImplementation((_name: string, cb: WakeHandler) => {
      handler = cb;
      return Promise.resolve(() => {});
    });
    await startWakeListener();

    useSessionStore.setState({ sessionStartedAt: "2026-09-05T09:00:00+00:00" });
    handler?.({ payload: {} });
    expect(currentSessionStartedAt()).toBe("2026-09-05T09:00:00+00:00");
  });

  // Outside a Tauri host there is no event bus. Losing the subscription costs
  // attribution precision; it must never cost the copy.
  it("survives a host with no event bus", async () => {
    listenMock.mockRejectedValue(new Error("no event bus"));
    const unlisten = await startWakeListener();
    expect(typeof unlisten).toBe("function");
    expect(currentSessionStartedAt()).toBeTruthy();
  });
});

describe("recordUsage — the session stamp is applied at the ipc layer", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ id: "u1" });
  });

  // Stamping here rather than at each call site is what keeps a newly added
  // copy path from silently dropping out of the ledger.
  it("stamps every record with the current session", async () => {
    useSessionStore.setState({ sessionStartedAt: "2026-09-05T09:00:00+00:00" });
    await ipc.recordUsage(RECORD);

    expect(invokeMock).toHaveBeenCalledWith("record_usage", {
      input: { ...RECORD, sessionStartedAt: "2026-09-05T09:00:00+00:00" },
      suppressHide: undefined,
    });
  });

  it("keeps a stamp the caller supplied", async () => {
    useSessionStore.setState({ sessionStartedAt: "2026-09-05T09:00:00+00:00" });
    await ipc.recordUsage(
      { ...RECORD, sessionStartedAt: "2026-01-01T00:00:00+00:00" },
      true,
    );

    expect(invokeMock).toHaveBeenCalledWith("record_usage", {
      input: { ...RECORD, sessionStartedAt: "2026-01-01T00:00:00+00:00" },
      suppressHide: true,
    });
  });
});
