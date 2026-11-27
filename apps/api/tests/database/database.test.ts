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
        "accounts",
        "account_settings",
        "account_roles",
        "auth_sessions",
        "auth_challenges",
        "auth_replay_nonces",
        "admin_totp_credentials",
        "d1_migrations",
        "feature_flags",
        "idempotency_keys",
        "privacy_requests",
        "security_events",
        "system_settings",
        "financial_wallets",
        "financial_operations",
        "credit_buckets",
        "financial_ledger_entries",
        "credit_reservations",
        "subscription_contracts",
        "pricing_versions",
        "promo_codes",
        "referrals",
        "payment_intents",
      ]),
    );
  });

  it("tracks every applied migration", async () => {
    const rows = await env.DB.prepare("SELECT name FROM d1_migrations ORDER BY id").all<{
      name: string;
    }>();
    expect(rows.results.map((row) => row.name)).toEqual([
      "0001_system_foundation.sql",
      "0002_seed_feature_flags.sql",
      "0003_authentication_account.sql",
      "0004_seed_authentication_flags.sql",
      "0005_financial_core.sql",
      "0006_seed_financial_flags.sql",
    ]);
  });

  it("enforces unique Telegram identity and replay keys", async () => {
    await env.DB.prepare("INSERT INTO accounts (id, telegram_user_id) VALUES (?1, ?2)")
      .bind("unique-account-1", 830000001)
      .run();
    await expect(
      env.DB.prepare("INSERT INTO accounts (id, telegram_user_id) VALUES (?1, ?2)")
        .bind("unique-account-2", 830000001)
        .run(),
    ).rejects.toThrow();

    await env.DB.prepare(
      "INSERT INTO auth_replay_nonces (nonce_hash, source, expires_at) VALUES (?1, 'mini_app', ?2)",
    )
      .bind("a".repeat(64), "2099-01-01T00:00:00.000Z")
      .run();
    await expect(
      env.DB.prepare(
        "INSERT INTO auth_replay_nonces (nonce_hash, source, expires_at) VALUES (?1, 'web_oidc', ?2)",
      )
        .bind("a".repeat(64), "2099-01-01T00:00:00.000Z")
        .run(),
    ).rejects.toThrow();
  });

  it("keeps security events append-only", async () => {
    await env.DB.prepare(
      "INSERT INTO security_events (id, event_type, request_id) VALUES (?1, ?2, ?3)",
    )
      .bind("security-append-only", "test_event", "security-request")
      .run();
    await expect(
      env.DB.prepare("DELETE FROM security_events WHERE id = ?1")
        .bind("security-append-only")
        .run(),
    ).rejects.toThrow(/append-only/);
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

  it("keeps financial ledger entries append-only", async () => {
    await env.DB.prepare("INSERT INTO accounts (id, telegram_user_id) VALUES (?1, ?2)")
      .bind("financial-append-account", 830000099)
      .run();
    await env.DB.prepare(
      "INSERT INTO financial_operations (id, account_id, operation_type, idempotency_scope, idempotency_key, request_hash) VALUES (?1, ?2, 'grant', 'test', 'test-key', ?3)",
    )
      .bind("financial-append-operation", "financial-append-account", "0".repeat(64))
      .run();
    await env.DB.prepare(
      "INSERT INTO credit_buckets (id, account_id, source_type, source_reference, initial_microcredits, available_microcredits) VALUES (?1, ?2, 'admin_bonus', 'test', 10, 10)",
    )
      .bind("financial-append-bucket", "financial-append-account")
      .run();
    await env.DB.prepare(
      "INSERT INTO financial_ledger_entries (id, operation_id, account_id, bucket_id, entry_type, available_delta, description) VALUES (?1, ?2, ?3, ?4, 'grant', 10, 'test grant')",
    )
      .bind(
        "financial-append-entry",
        "financial-append-operation",
        "financial-append-account",
        "financial-append-bucket",
      )
      .run();
    await expect(
      env.DB.prepare("DELETE FROM financial_ledger_entries WHERE id = ?1")
        .bind("financial-append-entry")
        .run(),
    ).rejects.toThrow(/append-only/);
  });
});
