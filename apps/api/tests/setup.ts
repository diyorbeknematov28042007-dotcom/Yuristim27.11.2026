import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll } from "vitest";

beforeAll(async () => {
  // Generated binding types and the test helper use equivalent runtime D1Migration shapes.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
