import { env, SELF } from "cloudflare:test";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { bearerHeaders, createBotSession } from "../helpers/auth";
import { network } from "../helpers/network";

const dataOf = async <T>(response: Response): Promise<T> => {
  const payload = await response.json<{ data: T }>();
  return payload.data;
};

const ensureSyntheticPricing = async (): Promise<void> => {
  let version = await env.DB.prepare(
    "SELECT id FROM pricing_versions WHERE status = 'active'",
  ).first<{
    id: string;
  }>();
  if (version === null) {
    await env.DB.prepare(
      `INSERT INTO pricing_versions (id, version, status, markup_multiplier, effective_at)
       VALUES ('ai-test-price-version', 9701, 'active', 4, ?1)`,
    )
      .bind(new Date().toISOString())
      .run();
    version = { id: "ai-test-price-version" };
  }
  await env.DB.prepare(
    `INSERT OR IGNORE INTO pricing_items (
      id, version_id, price_key, service_key, provider, unit_name,
      pricing_type, unit_cost_microunits, currency
    ) VALUES ('ai-test-google-price', ?1, 'ai.google.gemini.total_token',
      'ai-lite', 'google', 'token', 'measured', 1, 'UZS')`,
  )
    .bind(version.id)
    .run();
};

describe("Yuristim AI API", () => {
  it("denies unauthenticated access", async () => {
    const response = await SELF.fetch("https://example.test/api/v1/ai/models");
    expect(response.status).toBe(401);
  });

  it("protects the staging provider probe with a separate operational secret", async () => {
    const denied = await SELF.fetch("https://example.test/api/v1/ops/ai/gemini/probe", {
      method: "POST",
    });
    expect(denied.status).toBe(401);
    network.use(
      http.post("https://gemini.test/v1beta/interactions", () =>
        HttpResponse.json({
          id: "synthetic_probe",
          steps: [{ type: "model_output", content: [{ type: "text", text: "YURISTIM_LITE_OK" }] }],
          usage: { total_input_tokens: 6, total_output_tokens: 2, total_tokens: 8 },
        }),
      ),
    );
    const allowed = await SELF.fetch("https://example.test/api/v1/ops/ai/gemini/probe", {
      method: "POST",
      headers: { "x-yuristim-ops-token": "synthetic-ops-probe-token-that-is-long-enough" },
    });
    expect(allowed.status).toBe(200);
    expect(await dataOf<{ model: string; status: string }>(allowed)).toEqual({
      provider: "google",
      model: "Lite",
      status: "available",
      usage: { inputUnits: 6, outputUnits: 2 },
    });
  });

  it("creates, searches, renames, archives and soft-deletes account-isolated chats", async () => {
    const { accessToken } = await createBotSession(SELF, "870000001");
    const headers = bearerHeaders(accessToken);
    const created = await SELF.fetch("https://example.test/api/v1/ai/conversations", {
      method: "POST",
      headers,
      body: JSON.stringify({ model: "Lite", title: "Mehnat huquqi" }),
    });
    expect(created.status).toBe(201);
    const conversation = await dataOf<{ id: string }>(created);
    const searched = await SELF.fetch("https://example.test/api/v1/ai/conversations?q=Mehnat", {
      headers,
    });
    expect(await dataOf<{ conversations: Array<{ id: string }> }>(searched)).toMatchObject({
      conversations: [{ id: conversation.id }],
    });
    const updated = await SELF.fetch(
      `https://example.test/api/v1/ai/conversations/${conversation.id}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ title: "Mehnat shartnomasi", status: "archived" }),
      },
    );
    expect(await dataOf<{ title: string; status: string }>(updated)).toMatchObject({
      title: "Mehnat shartnomasi",
      status: "archived",
    });
    const other = await createBotSession(SELF, "870000002");
    const isolated = await SELF.fetch(
      `https://example.test/api/v1/ai/conversations/${conversation.id}`,
      { headers: bearerHeaders(other.accessToken) },
    );
    expect(isolated.status).toBe(404);
    const removed = await SELF.fetch(
      `https://example.test/api/v1/ai/conversations/${conversation.id}`,
      { method: "DELETE", headers },
    );
    expect(removed.status).toBe(204);
  });

  it("keeps Pro fail-closed without an OpenAI secret and creates no reservation", async () => {
    const user = await createBotSession(SELF, "870000003");
    const headers = bearerHeaders(user.accessToken);
    const created = await SELF.fetch("https://example.test/api/v1/ai/conversations", {
      method: "POST",
      headers,
      body: JSON.stringify({ model: "Pro" }),
    });
    const conversation = await dataOf<{ id: string }>(created);
    const response = await SELF.fetch(
      `https://example.test/api/v1/ai/conversations/${conversation.id}/messages`,
      {
        method: "POST",
        headers: { ...headers, "idempotency-key": "pro-fail-closed-001" },
        body: JSON.stringify({ content: "Synthetic question", maxMicrocredits: 1000000 }),
      },
    );
    expect(response.status).toBe(503);
    const count = await env.DB.prepare(
      "SELECT count(*) AS count FROM credit_reservations WHERE account_id = ?1",
    )
      .bind(user.accountId)
      .first<{ count: number }>();
    expect(count?.count).toBe(0);
  });

  it("runs Lite through reservation, verified provider usage and idempotent settlement", async () => {
    await ensureSyntheticPricing();
    network.use(
      http.post("https://gemini.test/v1beta/interactions", () =>
        HttpResponse.json({
          id: "synthetic_interaction_1",
          steps: [
            {
              type: "model_output",
              content: [{ type: "text", text: "Synthetic legal explanation" }],
            },
          ],
          usage: { total_input_tokens: 12, total_output_tokens: 8, total_tokens: 20 },
        }),
      ),
    );
    const user = await createBotSession(SELF, "870000004");
    const headers = bearerHeaders(user.accessToken);
    const created = await SELF.fetch("https://example.test/api/v1/ai/conversations", {
      method: "POST",
      headers,
      body: JSON.stringify({ model: "Lite", title: "Synthetic Lite" }),
    });
    const conversation = await dataOf<{ id: string }>(created);
    const request = () =>
      SELF.fetch(`https://example.test/api/v1/ai/conversations/${conversation.id}/messages`, {
        method: "POST",
        headers: { ...headers, "idempotency-key": "lite-generation-001" },
        body: JSON.stringify({ content: "Synthetic question", maxMicrocredits: 1000000 }),
      });
    const response = await request();
    expect(response.status).toBe(201);
    expect(
      await dataOf<{ model: string; verificationStatus: string; chargedMicrocredits: number }>(
        response,
      ),
    ).toMatchObject({ model: "Lite", verificationStatus: "unverified", chargedMicrocredits: 80 });

    const duplicate = await request();
    expect(duplicate.status).toBe(409);
    const operations = await env.DB.prepare(
      "SELECT count(*) AS count FROM financial_operations WHERE account_id = ?1 AND idempotency_scope = 'reservation_settlement'",
    )
      .bind(user.accountId)
      .first<{ count: number }>();
    expect(operations?.count).toBe(1);
  });

  it("requires explicit consent for memory and blocks storage-dependent document upload", async () => {
    const user = await createBotSession(SELF, "870000005");
    const headers = bearerHeaders(user.accessToken);
    const invalid = await SELF.fetch("https://example.test/api/v1/ai/memory", {
      method: "POST",
      headers,
      body: JSON.stringify({
        scope: "global",
        content: "Synthetic preference",
        consent: false,
        consentVersion: "memory-v1",
      }),
    });
    expect(invalid.status).toBe(400);
    const upload = await SELF.fetch("https://example.test/api/v1/ai/documents/upload", {
      method: "POST",
      headers,
      body: JSON.stringify({ fileName: "test.pdf" }),
    });
    expect(upload.status).toBe(403);
  });

  it("streams Lite SSE and settles only after provider usage arrives", async () => {
    await ensureSyntheticPricing();
    network.use(
      http.post(
        "https://gemini.test/v1beta/interactions",
        () =>
          new HttpResponse(
            [
              'event: step.delta\ndata: {"event_type":"step.delta","delta":{"type":"text","text":"Synthetic "}}\n\n',
              'event: step.delta\ndata: {"event_type":"step.delta","delta":{"type":"text","text":"stream"}}\n\n',
              'event: interaction.completed\ndata: {"event_type":"interaction.completed","interaction":{"id":"stream_1","usage":{"total_input_tokens":10,"total_output_tokens":5,"total_tokens":15}}}\n\n',
            ].join(""),
            { headers: { "content-type": "text/event-stream" } },
          ),
      ),
    );
    const user = await createBotSession(SELF, "870000006");
    const headers = bearerHeaders(user.accessToken);
    const created = await SELF.fetch("https://example.test/api/v1/ai/conversations", {
      method: "POST",
      headers,
      body: JSON.stringify({ model: "Lite", title: "Synthetic stream" }),
    });
    const conversation = await dataOf<{ id: string }>(created);
    const response = await SELF.fetch(
      `https://example.test/api/v1/ai/conversations/${conversation.id}/stream`,
      {
        method: "POST",
        headers: { ...headers, "idempotency-key": "lite-streaming-001" },
        body: JSON.stringify({ content: "Synthetic streaming question", maxMicrocredits: 1000000 }),
      },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const stream = await response.text();
    expect(stream).toContain('event: delta\ndata: {"text":"Synthetic "}');
    expect(stream).toContain("event: completed");
    const settlement = await env.DB.prepare(
      `SELECT actual_units AS actualUnits, status FROM credit_reservations
       WHERE account_id = ?1 AND idempotency_key = 'ai:lite-streaming-001'`,
    )
      .bind(user.accountId)
      .first<{ actualUnits: number; status: string }>();
    expect(settlement).toEqual({ actualUnits: 15, status: "settled" });
  });

  it("stores only explicit memory consent and supports user deletion", async () => {
    const user = await createBotSession(SELF, "870000007");
    const headers = bearerHeaders(user.accessToken);
    const created = await SELF.fetch("https://example.test/api/v1/ai/memory", {
      method: "POST",
      headers,
      body: JSON.stringify({
        scope: "global",
        content: "Synthetic consented preference",
        consent: true,
        consentVersion: "memory-v1",
      }),
    });
    expect(created.status).toBe(201);
    const memory = await dataOf<{ id: string }>(created);
    const listed = await SELF.fetch("https://example.test/api/v1/ai/memory", { headers });
    expect(await dataOf<{ memories: Array<{ id: string }> }>(listed)).toMatchObject({
      memories: [{ id: memory.id }],
    });
    const removed = await SELF.fetch(`https://example.test/api/v1/ai/memory/${memory.id}`, {
      method: "DELETE",
      headers,
    });
    expect(removed.status).toBe(204);
  });
});
