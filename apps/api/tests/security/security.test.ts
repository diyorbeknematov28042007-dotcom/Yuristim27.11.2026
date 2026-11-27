import { env, SELF } from "cloudflare:test";
import { requireAnyRole, requireAuthentication } from "@yuristim/security";
import { sanitizeLogData } from "@yuristim/logger";
import { describe, expect, it } from "vitest";

describe("security foundation", () => {
  it("default-denies unauthenticated protected requests", async () => {
    const response = await SELF.fetch("https://example.test/api/v1/account");
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("rejects principals without an allowed role", () => {
    const principal = requireAuthentication({ accountId: "a", sessionId: "s", roles: ["user"] });
    expect(() => requireAnyRole(principal, ["admin"])).toThrowError(/Insufficient permissions/);
  });

  it("rejects origins outside the configured allowlist", async () => {
    const response = await SELF.fetch("https://example.test/api/v1/status", {
      headers: { origin: "https://evil.example" },
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      success: false,
      error: { code: "FORBIDDEN" },
    });
  });

  it("rejects invalid query input", async () => {
    const response = await SELF.fetch("https://example.test/api/v1/services?locale=invalid");
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("rejects oversized payloads before route handling", async () => {
    const response = await SELF.fetch("https://example.test/api/v1/status", {
      method: "POST",
      headers: { "content-length": "1048577" },
      body: "x",
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      success: false,
      error: { code: "PAYLOAD_TOO_LARGE" },
    });
  });

  it("does not echo sensitive request values", async () => {
    const secret = "Bearer stage-secret-value";
    const response = await SELF.fetch("https://example.test/api/v1/missing?token=private", {
      headers: { authorization: secret, cookie: "session=private" },
    });
    const body = JSON.stringify(await response.json());
    expect(body).not.toContain(secret);
    expect(body).not.toContain("private");
    expect(body).not.toContain("token");
  });

  it("cannot enable a feature through client headers", async () => {
    await env.DB.prepare("UPDATE feature_flags SET enabled = 0 WHERE key = ?1")
      .bind("ai_provider_execution")
      .run();
    const response = await SELF.fetch("https://example.test/api/v1/services", {
      headers: { "x-feature-flag-ai-provider-execution": "true" },
    });
    const body = JSON.stringify(await response.json());
    expect(body).toContain('"id":"yuristim-ai","name":"Yuristim AI","status":"disabled"');
  });

  it("redacts sensitive structured log fields", () => {
    expect(
      sanitizeLogData({
        requestId: "safe",
        authorization: "Bearer private",
        nested: { telegramInitData: "private", apiKey: "private" },
      }),
    ).toEqual({
      requestId: "safe",
      authorization: "[REDACTED]",
      nested: { telegramInitData: "[REDACTED]", apiKey: "[REDACTED]" },
    });
  });

  it("sets secure response headers", async () => {
    const response = await SELF.fetch("https://example.test/health");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
