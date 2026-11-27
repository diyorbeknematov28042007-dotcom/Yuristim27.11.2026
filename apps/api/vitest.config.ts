import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(
        path.resolve(import.meta.dirname, "../../migrations"),
      );
      return {
        wrangler: { configPath: path.resolve(import.meta.dirname, "wrangler.jsonc") },
        miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
      };
    }),
  ],
  test: {
    setupFiles: [path.resolve(import.meta.dirname, "tests/setup.ts")],
    include: [path.resolve(import.meta.dirname, "tests/**/*.test.ts")],
    testTimeout: 10_000,
    reporters: ["default"],
  },
});
