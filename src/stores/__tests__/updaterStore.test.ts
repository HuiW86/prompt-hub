import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Tauri plugins BEFORE importing the store — it captures `check` /
// `relaunch` at module load.
const checkMock = vi.fn();
const relaunchMock = vi.fn();
vi.mock("@tauri-apps/plugin-updater", () => ({
  check: (...args: unknown[]) => checkMock(...args),
}));
vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: (...args: unknown[]) => relaunchMock(...args),
}));

import { useToastStore } from "../toastStore";
import { useUpdaterStore } from "../updaterStore";

const initial = useUpdaterStore.getState();

describe("updaterStore", () => {
  beforeEach(() => {
    useUpdaterStore.setState(initial, true);
    checkMock.mockReset();
    relaunchMock.mockReset();
    vi.restoreAllMocks();
  });

  // ADR-017 §5.3 / constitution A2: the total switch governs ALL egress. With
  // the switch off, check() must never reach the network — not even on a manual
  // trigger. This is the load-bearing zero-egress guarantee.
  it("check() makes zero network calls when disabled", async () => {
    useUpdaterStore.setState({ enabled: false });
    await useUpdaterStore.getState().check(true);
    expect(checkMock).not.toHaveBeenCalled();
    expect(useUpdaterStore.getState().status).toBe("idle");
  });

  it("check() queries the updater when enabled and reports an available version", async () => {
    checkMock.mockResolvedValue({ version: "0.2.0" });
    useUpdaterStore.setState({ enabled: true, optInDecided: true });
    await useUpdaterStore.getState().check();
    expect(checkMock).toHaveBeenCalledOnce();
    expect(useUpdaterStore.getState().status).toBe("available");
    expect(useUpdaterStore.getState().availableVersion).toBe("0.2.0");
  });

  it("check() reports up-to-date when the plugin returns null", async () => {
    checkMock.mockResolvedValue(null);
    useUpdaterStore.setState({ enabled: true, optInDecided: true });
    await useUpdaterStore.getState().check();
    expect(useUpdaterStore.getState().status).toBe("uptodate");
    expect(useUpdaterStore.getState().availableVersion).toBeNull();
  });

  it("acceptOptIn enables the switch and kicks off a check", async () => {
    checkMock.mockResolvedValue(null);
    useUpdaterStore.getState().acceptOptIn();
    expect(useUpdaterStore.getState().enabled).toBe(true);
    expect(useUpdaterStore.getState().optInDecided).toBe(true);
    expect(checkMock).toHaveBeenCalledOnce();
  });

  // P0-4: an auto (startup) check failure must stay silent — no "error" status
  // (which drives the persistent UpdaterBanner) and no toast. Otherwise every
  // offline release launch grows a stuck "更新失败" banner pushing the whole
  // dashboard down.
  it("auto check() failure is silent: no error status, no error field, no toast", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const toastSpy = vi.spyOn(useToastStore.getState(), "show");
    checkMock.mockRejectedValue(new Error("network unreachable"));
    useUpdaterStore.setState({ enabled: true, optInDecided: true });
    await useUpdaterStore.getState().check();
    expect(useUpdaterStore.getState().status).toBe("idle");
    // No UI surface renders `error` outside status === "error" — keeping the
    // message around would be a dead state, so the silent path clears it.
    expect(useUpdaterStore.getState().error).toBeNull();
    expect(toastSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  // Manual trigger (设置页「检查更新」) keeps the loud failure feedback:
  // error status (banner + settings status line) plus a toast.
  it("manual check() failure surfaces error status and error toast", async () => {
    const toastSpy = vi.spyOn(useToastStore.getState(), "showError");
    checkMock.mockRejectedValue(new Error("boom"));
    useUpdaterStore.setState({ enabled: true, optInDecided: true });
    await useUpdaterStore.getState().check(true);
    expect(useUpdaterStore.getState().status).toBe("error");
    expect(toastSpy).toHaveBeenCalledWith("检查更新失败");
  });

  // acceptOptIn is an explicit user gesture — its kicked-off check runs as
  // manual so a failure right after enabling is not silently swallowed.
  it("acceptOptIn failure is surfaced (manual semantics)", async () => {
    const toastSpy = vi.spyOn(useToastStore.getState(), "showError");
    checkMock.mockRejectedValue(new Error("boom"));
    useUpdaterStore.getState().acceptOptIn();
    await vi.waitFor(() => {
      expect(useUpdaterStore.getState().status).toBe("error");
    });
    expect(toastSpy).toHaveBeenCalledWith("检查更新失败");
  });

  it("declineOptIn records the decision without enabling egress", () => {
    useUpdaterStore.getState().declineOptIn();
    expect(useUpdaterStore.getState().enabled).toBe(false);
    expect(useUpdaterStore.getState().optInDecided).toBe(true);
  });
});
