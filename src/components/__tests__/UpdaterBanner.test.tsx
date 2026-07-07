import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The store imports the Tauri updater / process plugins at module load; stub
// them so the component test never touches the real bridge.
vi.mock("@tauri-apps/plugin-updater", () => ({ check: vi.fn() }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn() }));

import { useUpdaterStore } from "../../stores/updaterStore";
import { UpdaterBanner } from "../UpdaterBanner";

const initial = useUpdaterStore.getState();

describe("UpdaterBanner — downloading state (P1-6)", () => {
  beforeEach(() => {
    useUpdaterStore.setState(initial, true);
  });

  it("shows a determinate percentage + progressbar when progress is known", () => {
    useUpdaterStore.setState({
      optInDecided: true,
      status: "downloading",
      downloadProgress: 0.42,
    });
    const { getByRole, getByText } = render(<UpdaterBanner />);
    expect(getByText(/42%/)).toBeInTheDocument();
    const bar = getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "42");
  });

  it("falls back to an indeterminate label when progress is null", () => {
    useUpdaterStore.setState({
      optInDecided: true,
      status: "downloading",
      downloadProgress: null,
    });
    const { getByRole, queryByText } = render(<UpdaterBanner />);
    // No percentage in the message when total size is unknown.
    expect(queryByText(/%/)).toBeNull();
    const bar = getByRole("progressbar");
    expect(bar).not.toHaveAttribute("aria-valuenow");
  });

  it("disables the action button while downloading (no re-trigger)", () => {
    useUpdaterStore.setState({
      optInDecided: true,
      status: "downloading",
      downloadProgress: 0.1,
    });
    const { getByRole } = render(<UpdaterBanner />);
    const btn = getByRole("button", { name: "下载中…" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("offers an enabled install button in the available state", () => {
    useUpdaterStore.setState({
      optInDecided: true,
      status: "available",
      availableVersion: "0.2.0",
    });
    const { getByRole } = render(<UpdaterBanner />);
    expect(getByRole("button", { name: "下载并安装" })).toBeEnabled();
  });
});
