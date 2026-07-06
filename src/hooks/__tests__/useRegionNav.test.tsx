import { fireEvent, render } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it } from "vitest";

import { useRegionNav } from "../useRegionNav";

// Minimal harness: a region container wired with the hook plus three nav items
// and one text input, mirroring the real region shape (container tabIndex=0,
// items tabIndex=-1). The live handler is captured so guard branches that jsdom
// can't reproduce through React's synthetic event (isComposing / keyCode) can be
// exercised by invoking it directly with a crafted event.
let capturedHandler: (e: React.KeyboardEvent<HTMLElement>) => void;

function Region() {
  const onKeyDown = useRegionNav();
  capturedHandler = onKeyDown;
  return (
    <section data-region="test" tabIndex={0} onKeyDown={onKeyDown}>
      <button data-nav-item tabIndex={-1} data-testid="a">
        A
      </button>
      <button data-nav-item tabIndex={-1} data-testid="b">
        B
      </button>
      <button data-nav-item tabIndex={-1} data-testid="c">
        C
      </button>
      <input data-testid="field" />
    </section>
  );
}

function setup() {
  const utils = render(<Region />);
  const region = utils.container.querySelector(
    "[data-region='test']",
  ) as HTMLElement;
  return { ...utils, region };
}

// Build a partial React.KeyboardEvent good enough for the hook: real DOM nodes
// for target/currentTarget, a spy preventDefault, and the keyboard flags.
function fakeEvent(
  region: HTMLElement,
  init: {
    key: string;
    target?: HTMLElement;
    isComposing?: boolean;
    keyCode?: number;
    metaKey?: boolean;
    ctrlKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
  },
) {
  return {
    key: init.key,
    target: init.target ?? region,
    currentTarget: region,
    // The hook reads isComposing off the native event (the React synthetic type
    // doesn't surface it).
    nativeEvent: { isComposing: init.isComposing ?? false },
    keyCode: init.keyCode ?? 0,
    metaKey: init.metaKey ?? false,
    ctrlKey: init.ctrlKey ?? false,
    altKey: init.altKey ?? false,
    shiftKey: init.shiftKey ?? false,
    preventDefault: () => {},
  } as unknown as React.KeyboardEvent<HTMLElement>;
}

describe("useRegionNav", () => {
  it("ArrowRight from the container focuses the first item", () => {
    const { region, getByTestId } = setup();
    region.focus();
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(document.activeElement).toBe(getByTestId("a"));
  });

  it("ArrowUp from the container enters at the last item", () => {
    const { region, getByTestId } = setup();
    region.focus();
    fireEvent.keyDown(region, { key: "ArrowUp" });
    expect(document.activeElement).toBe(getByTestId("c"));
  });

  it("ArrowRight / ArrowDown advance, ArrowLeft / ArrowUp retreat", () => {
    const { region, getByTestId } = setup();
    getByTestId("a").focus();
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(document.activeElement).toBe(getByTestId("b"));
    fireEvent.keyDown(region, { key: "ArrowDown" });
    expect(document.activeElement).toBe(getByTestId("c"));
    fireEvent.keyDown(region, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(getByTestId("b"));
    fireEvent.keyDown(region, { key: "ArrowUp" });
    expect(document.activeElement).toBe(getByTestId("a"));
  });

  it("does not wrap past either end", () => {
    const { region, getByTestId } = setup();
    getByTestId("a").focus();
    fireEvent.keyDown(region, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(getByTestId("a"));
    getByTestId("c").focus();
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(document.activeElement).toBe(getByTestId("c"));
  });

  it("Home / End jump to first / last item", () => {
    const { region, getByTestId } = setup();
    getByTestId("b").focus();
    fireEvent.keyDown(region, { key: "End" });
    expect(document.activeElement).toBe(getByTestId("c"));
    fireEvent.keyDown(region, { key: "Home" });
    expect(document.activeElement).toBe(getByTestId("a"));
  });

  it("ignores arrows while focus is inside a text input", () => {
    const { getByTestId } = setup();
    const field = getByTestId("field") as HTMLElement;
    field.focus();
    // Fire from the input so it bubbles to the region handler with the input as
    // e.target — the guard must bow out and leave the caret where it is.
    fireEvent.keyDown(field, { key: "ArrowRight" });
    expect(document.activeElement).toBe(field);
  });

  it("ignores arrows while an IME is composing", () => {
    const { region, getByTestId } = setup();
    const a = getByTestId("a") as HTMLElement;
    a.focus();
    // jsdom doesn't surface isComposing / keyCode through React's synthetic
    // event, so drive the captured handler directly with those flags set.
    act(() => {
      capturedHandler(
        fakeEvent(region, { key: "ArrowRight", isComposing: true }),
      );
    });
    expect(document.activeElement).toBe(a);
    act(() => {
      capturedHandler(fakeEvent(region, { key: "ArrowRight", keyCode: 229 }));
    });
    expect(document.activeElement).toBe(a);
  });

  it("ignores arrows carrying a modifier key", () => {
    const { region, getByTestId } = setup();
    getByTestId("a").focus();
    for (const mod of ["metaKey", "ctrlKey", "altKey", "shiftKey"] as const) {
      fireEvent.keyDown(region, { key: "ArrowRight", [mod]: true });
      expect(document.activeElement).toBe(getByTestId("a"));
    }
  });
});
