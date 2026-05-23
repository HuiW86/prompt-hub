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
