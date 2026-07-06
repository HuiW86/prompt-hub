import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Macro } from "../../ipc/types";
import { usePromptStore } from "../../stores/promptStore";
import { useSearchStore } from "../../stores/searchStore";
import { useSearchResults } from "../useSearchResults";

const fakeMacro: Macro = {
  id: "macro-leverage",
  name: "借力最优解",
  content: "调研外部成熟方案",
  expandFrom: null,
  native: true,
  role: null,
  task: null,
  usageCount: 9,
  lastUsedAt: null,
  createdAt: "2026-05-23T00:00:00Z",
  notes: null,
  sceneId: null,
  deprecated: false,
  orderIndex: 0,
};

const initialPrompt = usePromptStore.getState();
const initialSearch = useSearchStore.getState();

describe("useSearchResults debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    usePromptStore.setState(initialPrompt, true);
    useSearchStore.setState(initialSearch, true);
    usePromptStore.setState({
      phases: [],
      alignmentPhrasesByPhase: {},
      macros: [fakeMacro],
      scenes: [],
      loadState: "ready",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies the first character immediately (no empty-state flash)", () => {
    const { result } = renderHook(() => useSearchResults());
    // Empty→non-empty edge bypasses the debounce so the just-opened overlay
    // shows results on the first keystroke.
    act(() => {
      useSearchStore.getState().setQuery("借");
    });
    expect(result.current.total).toBe(1);
    expect(result.current.query).toBe("借");
  });

  it("debounces mid-search edits: only the final query computes", () => {
    const { result } = renderHook(() => useSearchResults());

    // First character is immediate.
    act(() => {
      useSearchStore.getState().setQuery("借");
    });
    expect(result.current.query).toBe("借");

    // A burst of mid-search edits within one debounce window. The heavy
    // filter keeps keying off the last-committed query ("借") until the timer
    // fires — the intermediate "借力x" never becomes the computed query.
    act(() => {
      useSearchStore.getState().setQuery("借力");
    });
    act(() => {
      useSearchStore.getState().setQuery("借力x");
    });
    // Still on the first committed query — debounce has not elapsed.
    expect(result.current.query).toBe("借");

    // Fire the debounce.
    act(() => {
      vi.advanceTimersByTime(120);
    });
    // Now the final query is committed (and "借力x" matches nothing).
    expect(result.current.query).toBe("借力x");
    expect(result.current.total).toBe(0);
  });

  it("clearing the query applies immediately (overlay dismisses without lag)", () => {
    const { result } = renderHook(() => useSearchResults());
    act(() => {
      useSearchStore.getState().setQuery("借");
    });
    expect(result.current.total).toBe(1);
    act(() => {
      useSearchStore.getState().clearQuery();
    });
    // No timer advance needed — empty query bypasses the debounce.
    expect(result.current.query).toBe("");
    expect(result.current.total).toBe(0);
  });
});
