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
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            TELEGRAM_BOT_TOKEN: "synthetic-telegram-bot-token-for-tests-only",
            BOT_ADAPTER_SECRET: "synthetic-bot-adapter-secret-for-tests-only",
            AUTH_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            OWNER_TELEGRAM_ID: "900000001",
            TELEGRAM_OIDC_CLIENT_ID: "synthetic-oidc-client",
            TELEGRAM_OIDC_CLIENT_SECRET: "synthetic-oidc-secret",
            TELEGRAM_OIDC_REDIRECT_URI: "https://example.test/auth/telegram/callback",
            GEMINI_API_KEY: "synthetic-gemini-api-key-for-tests-only",
            GEMINI_API_BASE_URL: "https://gemini.test/v1beta",
            AI_OPS_PROBE_TOKEN: "synthetic-ops-probe-token-that-is-long-enough",
          },
        },
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
