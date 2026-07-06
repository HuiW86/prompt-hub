import { render } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { useAppStore } from "../../stores/appStore";
import { usePromptStore } from "../../stores/promptStore";
import { useSearchStore } from "../../stores/searchStore";
import { SearchBar } from "../SearchBar";

const searchInitial = useSearchStore.getState();
const promptInitial = usePromptStore.getState();
const appInitial = useAppStore.getState();

function fireVisibility() {
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

describe("SearchBar — wake-to-focus (P0-1)", () => {
  beforeEach(() => {
    useSearchStore.setState(searchInitial, true);
    usePromptStore.setState(promptInitial, true);
    useAppStore.setState(appInitial, true);
    invokeMock.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("focuses the input on mount", () => {
    const { getByLabelText } = render(<SearchBar />);
    expect(document.activeElement).toBe(getByLabelText("搜索"));
  });

  it("re-focuses the input when the window becomes visible and focus is on body", () => {
    const { getByLabelText } = render(<SearchBar />);
    const input = getByLabelText("搜索");
    // Blur to the body — the idle state after the window is hidden.
    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).toBe(document.body);
    fireVisibility();
    expect(document.activeElement).toBe(input);
  });

  it("does NOT steal focus on visibility when another element is focused", () => {
    const other = document.createElement("input");
    document.body.appendChild(other);
    render(<SearchBar />);
    other.focus();
    expect(document.activeElement).toBe(other);
    fireVisibility();
    // Guard holds: focus stays on the unrelated field (an open edit form / modal).
    expect(document.activeElement).toBe(other);
  });
});
