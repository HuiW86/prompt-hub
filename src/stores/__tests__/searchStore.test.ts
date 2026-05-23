import { beforeEach, describe, expect, it } from "vitest";

import { selectIsSearching, useSearchStore } from "../searchStore";

const initial = useSearchStore.getState();

describe("searchStore", () => {
  beforeEach(() => {
    useSearchStore.setState(initial, true);
  });

  it("setQuery updates the query value", () => {
    useSearchStore.getState().setQuery("调研");
    expect(useSearchStore.getState().query).toBe("调研");
  });

  it("clearQuery resets to empty string", () => {
    useSearchStore.getState().setQuery("方案");
    useSearchStore.getState().clearQuery();
    expect(useSearchStore.getState().query).toBe("");
  });

  it("setQuery resets selectedIndex to 0", () => {
    useSearchStore.getState().setSelectedIndex(3);
    expect(useSearchStore.getState().selectedIndex).toBe(3);
    useSearchStore.getState().setQuery("调研");
    expect(useSearchStore.getState().selectedIndex).toBe(0);
  });

  it("selectIsSearching ignores whitespace-only queries", () => {
    const stub = {
      selectedIndex: 0,
      setQuery: () => {},
      clearQuery: () => {},
      setSelectedIndex: () => {},
    };
    expect(selectIsSearching({ ...stub, query: "" })).toBe(false);
    expect(selectIsSearching({ ...stub, query: "   " })).toBe(false);
    expect(selectIsSearching({ ...stub, query: "x" })).toBe(true);
  });
});
