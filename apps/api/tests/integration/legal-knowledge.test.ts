import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { bearerHeaders, createBotSession, createOwnerSession } from "../helpers/auth";

const dataOf = async <T>(response: Response): Promise<T> => {
  const payload = await response.json<{ data: T }>();
  return payload.data;
};

describe("Legal Knowledge Base API", () => {
  it("denies unauthenticated legal knowledge access", async () => {
    const response = await SELF.fetch("https://example.test/api/v1/legal/status");
    expect(response.status).toBe(401);
  });

  it("reports real seeded registry counts and fail-closed semantic search", async () => {
    const user = await createBotSession(SELF, "880000001");
    const response = await SELF.fetch("https://example.test/api/v1/legal/status", {
      headers: bearerHeaders(user.accessToken),
    });
    expect(response.status).toBe(200);
    expect(
      await dataOf<{
        sources: number;
        documents: number;
        provisions: number;
        lexicalSearch: string;
        semanticSearch: { status: string; reason: string; fallback: string };
      }>(response),
    ).toMatchObject({
      sources: 2,
      documents: 4,
      provisions: 6,
      lexicalSearch: "available_d1_fts5",
      semanticSearch: {
        status: "blocked",
        reason: "vectorize_not_authorized",
        fallback: "d1_fts5",
      },
    });
  });

  it("searches verified effective provisions and returns complete citations", async () => {
    const user = await createBotSession(SELF, "880000002");
    const response = await SELF.fetch(
      "https://example.test/api/v1/legal/search?q=Davlat%20xalq&authority=normative",
      { headers: bearerHeaders(user.accessToken) },
    );
    expect(response.status).toBe(200);
    const data = await dataOf<{
      verifiedOnly: boolean;
      results: Array<{
        body: string;
        citation: {
          documentTitle: string;
          provision: string;
          version: string;
          verifiedAt: string;
          officialUrl: string;
          completeness: string;
        };
      }>;
    }>(response);
    expect(data.verifiedOnly).toBe(true);
    expect(data.results).toHaveLength(1);
    expect(data.results[0]).toMatchObject({
      citation: {
        documentTitle: "Oʻzbekiston Respublikasi Konstitutsiyasi",
        provision: "2-modda",
        version: "25.07.2026",
        verifiedAt: "2026-11-28T00:00:00.000Z",
        officialUrl: "https://lex.uz/uz/docs/-6445145?ONDATE=25.07.2026+00",
        completeness: "partial",
      },
    });
  });

  it("does not mix metadata-only judicial listings into AI-grade search by default", async () => {
    const user = await createBotSession(SELF, "880000003");
    const headers = bearerHeaders(user.accessToken);
    const hidden = await SELF.fetch(
      "https://example.test/api/v1/legal/search?q=taftish%20tartibida",
      { headers },
    );
    expect((await dataOf<{ results: unknown[] }>(hidden)).results).toHaveLength(0);
    const visible = await SELF.fetch(
      "https://example.test/api/v1/legal/search?q=taftish%20tartibida&includeMetadata=true",
      { headers },
    );
    const result = await dataOf<{
      results: Array<{ citation: { authority: string; completeness: string } }>;
    }>(visible);
    expect(result.results[0]?.citation).toMatchObject({
      authority: "judicial_practice",
      completeness: "metadata_only",
    });
  });

  it("selects a document version by effective date", async () => {
    const user = await createBotSession(SELF, "880000004");
    const headers = bearerHeaders(user.accessToken);
    const unavailable = await SELF.fetch(
      "https://example.test/api/v1/legal/documents/legal-doc-constitution-uz?asOf=2026-07-24T23:59:59.000Z",
      { headers },
    );
    expect(unavailable.status).toBe(404);
    const current = await SELF.fetch(
      "https://example.test/api/v1/legal/documents/legal-doc-constitution-uz?asOf=2026-11-28T00:00:00.000Z",
      { headers },
    );
    expect(current.status).toBe(200);
    expect(
      await dataOf<{ version: string; verificationStatus: string; provisions: unknown[] }>(current),
    ).toMatchObject({ version: "25.07.2026", verificationStatus: "verified" });
  });

  it("treats FTS operators and SQL syntax as text rather than executable input", async () => {
    const user = await createBotSession(SELF, "880000005");
    const response = await SELF.fetch(
      `https://example.test/api/v1/legal/search?q=${encodeURIComponent('" OR 1=1 --')}`,
      { headers: bearerHeaders(user.accessToken) },
    );
    expect(response.status).toBe(200);
    expect((await dataOf<{ results: unknown[] }>(response)).results).toEqual([]);
    const documents = await env.DB.prepare("SELECT count(*) AS count FROM legal_documents").first<{
      count: number;
    }>();
    expect(documents?.count).toBeGreaterThanOrEqual(4);
  });

  it("enforces the server-side search feature flag and admin RBAC", async () => {
    const user = await createBotSession(SELF, "880000006");
    const headers = bearerHeaders(user.accessToken);
    await env.DB.prepare(
      "UPDATE feature_flags SET enabled = 0 WHERE key = 'legal_knowledge_search'",
    ).run();
    try {
      const disabled = await SELF.fetch("https://example.test/api/v1/legal/search?q=Davlat", {
        headers,
      });
      expect(disabled.status).toBe(403);
    } finally {
      await env.DB.prepare(
        "UPDATE feature_flags SET enabled = 1 WHERE key = 'legal_knowledge_search'",
      ).run();
    }
    const admin = await SELF.fetch("https://example.test/api/v1/admin/legal/sources", { headers });
    expect(admin.status).toBe(403);
  });

  it("allows only TOTP-elevated maintainers to import and reindex bounded official content", async () => {
    const owner = await createOwnerSession(SELF);
    const imported = await SELF.fetch("https://example.test/api/v1/admin/legal/imports", {
      method: "POST",
      headers: owner.headers,
      body: JSON.stringify({
        sourceId: "source-lex-uz",
        externalId: `synthetic-test-${crypto.randomUUID()}`,
        title: "Sintetik test hujjati — faqat avtomatik test uchun",
        documentNumber: null,
        documentType: "other",
        legalAuthority: "official_guidance",
        language: "uz-Latn",
        adoptedAt: null,
        officialUrl: "https://lex.uz/test-only-synthetic-fixture",
        versionLabel: "test-v1",
        legalStatus: "current",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
        effectiveTo: null,
        publishedAt: null,
        completeness: "partial",
        provisions: [
          {
            kind: "paragraph",
            number: null,
            heading: "Sintetik fixture",
            body: "Sintetik huquqiy qidiruv regressiya testi; real huquqiy manba emas.",
            path: "test/paragraph-1",
            ordinal: 1,
          },
        ],
      }),
    });
    expect(imported.status).toBe(201);
    const reindexed = await SELF.fetch("https://example.test/api/v1/admin/legal/reindex", {
      method: "POST",
      headers: owner.headers,
    });
    expect(reindexed.status).toBe(200);
    expect(await dataOf<{ indexed: number }>(reindexed)).toMatchObject({ indexed: 7 });
  });
});
