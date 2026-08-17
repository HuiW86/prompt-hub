import { describe, expect, it } from "vitest";

import { RECENT_LIMIT } from "../helpers";

describe("RECENT_LIMIT", () => {
  it("stays within the Rust-side clamp so the ask is never truncated", () => {
    // src-tauri/src/commands.rs RECENT_USAGE_LIMIT_MAX. The clamp silently
    // truncates instead of erroring, so nothing at runtime would surface a
    // breach — this assertion is the only guard on that cross-language coupling.
    const RECENT_USAGE_LIMIT_MAX = 100;
    expect(RECENT_LIMIT).toBeGreaterThan(0);
    expect(RECENT_LIMIT).toBeLessThanOrEqual(RECENT_USAGE_LIMIT_MAX);
  });
});
