import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "../ErrorBoundary";

// A child that throws on demand. `shouldThrow` is read at render time so a
// parent state flip can "heal" it between renders (used by the recovery test).
function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("boom");
  return <div>存活内容</div>;
}

// Harness whose 修复 button (kept OUTSIDE the boundary so it survives the
// fallback swap) clears the throw flag; after 重新加载 resets the boundary the
// subtree re-renders a healthy child.
function Harness() {
  const [broken, setBroken] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setBroken(false)}>
        修复
      </button>
      <ErrorBoundary>
        <Bomb shouldThrow={broken} />
      </ErrorBoundary>
    </>
  );
}

describe("ErrorBoundary", () => {
  // React logs the caught error to console.error; silence the expected noise so
  // the test output stays readable, and assert our own diagnostic still fires.
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    errSpy.mockRestore();
  });

  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <div>存活内容</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("存活内容")).toBeInTheDocument();
  });

  it("renders the fallback and logs a diagnostic when a child throws", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/页面出错了/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "重新加载" }),
    ).toBeInTheDocument();
    expect(errSpy).toHaveBeenCalledWith(
      "ErrorBoundary caught a render error:",
      expect.any(Error),
      expect.anything(),
    );
  });

  it("recovers to a healthy subtree after 重新加载 resets the boundary", () => {
    render(<Harness />);
    // Boundary is showing the fallback because Bomb threw on first render.
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Heal the child, then click 重新加载 to soft-reset the boundary and
    // re-render the now-healthy subtree.
    fireEvent.click(screen.getByText("修复"));
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("存活内容")).toBeInTheDocument();
  });
});
