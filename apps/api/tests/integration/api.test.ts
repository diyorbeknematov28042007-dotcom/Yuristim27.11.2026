import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const json = async (response: Response): Promise<Record<string, unknown>> =>
  response.json<Record<string, unknown>>();

describe("API gateway public endpoints", () => {
  it("returns a minimal liveness response", async () => {
    const response = await SELF.fetch("https://example.test/health");
    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ success: true, data: { status: "ok" } });
    expect(response.headers.get("x-request-id")).toMatch(/[0-9a-f-]{36}/);
  });

  it("checks D1 readiness", async () => {
    const response = await SELF.fetch("https://example.test/ready");
    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({
      success: true,
      data: { status: "ready", dependencies: { database: "available" } },
    });
  });

  it("returns safe public configuration", async () => {
    const response = await SELF.fetch("https://example.test/api/v1/config/public");
    const body = await json(response);
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: {
        supportedLocales: ["uz", "ru", "en"],
        authentication: "telegram_only",
        capabilities: { aiExecution: false, realPayments: false },
      },
    });
    expect(JSON.stringify(body)).not.toMatch(/token|secret|apiKey|authorization/i);
  });

  it("returns the API version", async () => {
    const response = await SELF.fetch("https://example.test/api/v1/version");
    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({
      success: true,
      data: { application: "0.4.0", api: "v1" },
    });
  });

  it("reports real service availability without fake implementations", async () => {
    const response = await SELF.fetch("https://example.test/api/v1/services?locale=uz");
    const body = await json(response);
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, data: { locale: "uz" } });
    expect(JSON.stringify(body)).toContain('"status":"disabled"');
    expect(JSON.stringify(body)).toContain('"status":"coming_soon"');
  });

  it("returns the OpenAPI 3.1 contract", async () => {
    const response = await SELF.fetch("https://example.test/api/v1/openapi.json");
    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({
      success: true,
      data: { openapi: "3.1.0", info: { version: "0.4.0" } },
    });
  });

  it("returns a standard not-found response", async () => {
    const response = await SELF.fetch("https://example.test/api/v1/missing");
    expect(response.status).toBe(404);
    const body = await json(response);
    expect(body).toMatchObject({
      success: false,
      error: { code: "NOT_FOUND", message: "Resource not found" },
    });
    const meta = body["meta"];
    expect(meta).toBeTypeOf("object");
    expect(typeof (meta as { requestId?: unknown }).requestId).toBe("string");
  });

  it("returns 405 for an unsupported method on a known route", async () => {
    const response = await SELF.fetch("https://example.test/health", { method: "POST" });
    expect(response.status).toBe(405);
    expect(await json(response)).toMatchObject({
      success: false,
      error: { code: "METHOD_NOT_ALLOWED" },
    });
  });
});
