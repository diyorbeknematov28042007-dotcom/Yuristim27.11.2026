import { applyD1Migrations, env } from "cloudflare:test";
import { afterAll, afterEach, beforeAll } from "vitest";
import { network } from "./helpers/network";

beforeAll(async () => {
  // Generated binding types and the test helper use equivalent runtime D1Migration shapes.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  network.enable();
});

afterEach(() => network.resetHandlers());
afterAll(() => network.disable());
