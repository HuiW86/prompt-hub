import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
export default {
  root: process.cwd(),
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: "harness-dist",
    emptyOutDir: true,
    rollupOptions: { input: resolve(process.cwd(), "harness/index.html") },
  },
};
