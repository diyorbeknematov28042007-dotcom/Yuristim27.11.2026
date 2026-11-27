import { env } from "cloudflare:test";
import { findSystemSetting } from "@yuristim/database";
import { describe, expect, it } from "vitest";

describe("D1 foundation migrations", () => {
  const executionPolicy = () => ({
    timeoutMs: 5_000,
    signal: new AbortController().signal,
  });

  it("creates the expected tables in a fresh database", async () => {
    const tables = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    ).all<{ name: string }>();
    expect(tables.results.map((row) => row.name)).toEqual(
      expect.arrayContaining([
        "audit_events",
        "d1_migrations",
        "feature_flags",
        "idempotency_keys",
        "system_settings",
      ]),
    );
  });

  it("tracks both applied migrations", async () => {
    const rows = await env.DB.prepare("SELECT name FROM d1_migrations ORDER BY id").all<{
      name: string;
    }>();
    expect(rows.results.map((row) => row.name)).toEqual([
      "0001_system_foundation.sql",
      "0002_seed_feature_flags.sql",
    ]);
  });

  it("enforces foreign key constraints", async () => {
    await expect(
      env.DB.prepare(
        "INSERT INTO audit_events (id, parent_event_id, actor_type, action, entity_type, request_id) VALUES (?1, ?2, 'system', 'test', 'test', ?3)",
      )
        .bind("event-child", "missing-parent", "request-fk")
        .run(),
    ).rejects.toThrow();
  });

  it("enforces unique constraints", async () => {
    await env.DB.prepare(
      "INSERT INTO idempotency_keys (id, scope, idempotency_key, request_hash, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)",
    )
      .bind("idem-1", "tests", "same-key", "hash-1", "2099-01-01T00:00:00.000Z")
      .run();
    await expect(
      env.DB.prepare(
        "INSERT INTO idempotency_keys (id, scope, idempotency_key, request_hash, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)",
      )
        .bind("idem-2", "tests", "same-key", "hash-2", "2099-01-01T00:00:00.000Z")
        .run(),
    ).rejects.toThrow();
  });

  it("uses prepared statements for untrusted keys", async () => {
    const malicious = "timezone' OR 1=1 --";
    expect(await findSystemSetting(env.DB, malicious, executionPolicy())).toBeNull();
    expect(await findSystemSetting(env.DB, "timezone", executionPolicy())).toBe('"Asia/Tashkent"');
  });

  it("keeps audit events append-only", async () => {
    await env.DB.prepare(
      "INSERT INTO audit_events (id, actor_type, action, entity_type, request_id) VALUES (?1, 'system', 'created', 'test', ?2)",
    )
      .bind("event-append-only", "request-append")
      .run();
    await expect(
      env.DB.prepare("UPDATE audit_events SET action = 'changed' WHERE id = ?1")
        .bind("event-append-only")
        .run(),
    ).rejects.toThrow(/append-only/);
  });
});
