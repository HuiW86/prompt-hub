/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // ADR-017 §5.5 / GHSA-2rcp-jvr4-r259: a wide envPrefix would inline
  // TAURI_SIGNING_PRIVATE_KEY into the shipped frontend bundle (= leaking the
  // minisign private key to every user). Lock the prefix to VITE_ only and
  // expose the few non-sensitive TAURI_* vars by explicit allowlist. NEVER add
  // any TAURI_SIGNING_* prefix here.
  envPrefix: [
    "VITE_",
    "TAURI_ENV_PLATFORM",
    "TAURI_ENV_ARCH",
    "TAURI_ENV_FAMILY",
    "TAURI_ENV_PLATFORM_VERSION",
    "TAURI_ENV_PLATFORM_TYPE",
    "TAURI_ENV_DEBUG",
  ],

  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
