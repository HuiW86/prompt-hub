import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Vitest doesn't auto-cleanup React Testing Library mounts; without this,
// rendered trees accumulate across `it` blocks in the same file.
afterEach(() => {
  cleanup();
});

// jsdom doesn't ship navigator.clipboard. Provide a writable mock so
// useClipboard.writeClipboard succeeds in tests.
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  configurable: true,
  writable: true,
});

// Default jsdom navigator.platform is empty / "Linux x86_64", which would make
// utils/platform.ts treat the test environment as non-Mac and require Ctrl
// modifiers everywhere. Pin to MacIntel so keyboard tests match the primary
// target platform; per-test overrides can re-set this for Win/Linux scenarios.
Object.defineProperty(navigator, "platform", {
  value: "MacIntel",
  configurable: true,
  writable: true,
});
