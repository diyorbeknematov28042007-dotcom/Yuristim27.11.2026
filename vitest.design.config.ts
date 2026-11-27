import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: [path.resolve(import.meta.dirname, "packages/ui/tests/setup.ts")],
    include: [
      path.resolve(import.meta.dirname, "packages/design-tokens/tests/**/*.test.ts"),
      path.resolve(import.meta.dirname, "packages/ui/tests/**/*.test.ts?(x)"),
    ],
    testTimeout: 10_000,
  },
});
