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

  it("selectIsSearching ignores whitespace-only queries", () => {
    expect(
      selectIsSearching({
        query: "",
        setQuery: () => {},
        clearQuery: () => {},
      }),
    ).toBe(false);
    expect(
      selectIsSearching({
        query: "   ",
        setQuery: () => {},
        clearQuery: () => {},
      }),
    ).toBe(false);
    expect(
      selectIsSearching({
        query: "x",
        setQuery: () => {},
        clearQuery: () => {},
      }),
    ).toBe(true);
  });
});
