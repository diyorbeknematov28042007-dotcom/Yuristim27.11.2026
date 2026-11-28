import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("Legal Knowledge D1 constraints", () => {
  it("tracks the seeded manual ingestion and FTS5 index", async () => {
    const runs = await env.DB.prepare(
      "SELECT count(*) AS count FROM legal_ingestion_runs WHERE status = 'completed'",
    ).first<{ count: number }>();
    const indexed = await env.DB.prepare(
      "SELECT count(*) AS count FROM legal_provisions_fts",
    ).first<{ count: number }>();
    expect(runs?.count).toBe(2);
    expect(indexed?.count).toBe(6);
  });

  it("prevents two current versions for the same legal document", async () => {
    await expect(
      env.DB.prepare(
        `INSERT INTO legal_document_versions (
          id, document_id, version_label, legal_status, verification_status,
          completeness, ingestion_method, source_hash, content_hash, source_url
        ) VALUES ('duplicate-current-version', 'legal-doc-constitution-uz', 'duplicate',
          'current', 'verified', 'partial', 'manual_verified', ?1, ?1,
          'https://lex.uz/uz/docs/-6445145')`,
      )
        .bind("a".repeat(64))
        .run(),
    ).rejects.toThrow();
  });

  it("maintains FTS5 rows through provision update triggers", async () => {
    const original = await env.DB.prepare(
      "SELECT body FROM legal_provisions WHERE id = 'legal-prov-constitution-1'",
    ).first<{ body: string }>();
    expect(original).not.toBeNull();
    await env.DB.prepare(
      "UPDATE legal_provisions SET body = body || ' vaqtinchasinov' WHERE id = 'legal-prov-constitution-1'",
    ).run();
    try {
      const match = await env.DB.prepare(
        "SELECT count(*) AS count FROM legal_provisions_fts WHERE legal_provisions_fts MATCH ?1",
      )
        .bind('"vaqtinchasinov"')
        .first<{ count: number }>();
      expect(match?.count).toBe(1);
    } finally {
      await env.DB.prepare(
        "UPDATE legal_provisions SET body = ?1 WHERE id = 'legal-prov-constitution-1'",
      )
        .bind(original?.body)
        .run();
    }
  });

  it("enforces source and version foreign keys", async () => {
    await expect(
      env.DB.prepare(
        `INSERT INTO legal_documents (
          id, source_id, external_id, title, document_type, legal_authority,
          official_url, status
        ) VALUES ('orphan-legal-doc', 'missing-source', 'orphan', 'Orphan document',
          'other', 'official_guidance', 'https://lex.uz/orphan', 'active')`,
      ).run(),
    ).rejects.toThrow();
  });
});
