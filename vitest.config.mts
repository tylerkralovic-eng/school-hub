import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src"), "server-only": path.resolve(__dirname, "tests/server-only-shim.ts") } },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: process.env.LIVE_AI ? [] : ["tests/live/**"],
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
