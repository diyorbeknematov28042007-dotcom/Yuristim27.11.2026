import { describe, expect, it } from "vitest";
import {
  assertOfficialLegalUrl,
  buildSafeFtsQuery,
  legalContextForPrompt,
  semanticSearchState,
} from "@yuristim/knowledge";

describe("Legal Knowledge safety helpers", () => {
  it("allows only exact HTTPS official source domains", () => {
    expect(assertOfficialLegalUrl("https://lex.uz/uz/docs/-6445145").hostname).toBe("lex.uz");
    expect(() => assertOfficialLegalUrl("http://lex.uz/uz/docs/-6445145")).toThrow();
    expect(() => assertOfficialLegalUrl("https://lex.uz.evil.test/document")).toThrow();
    expect(() => assertOfficialLegalUrl("https://user:pass@lex.uz/document")).toThrow();
  });

  it("quotes every FTS token and drops operators", () => {
    expect(buildSafeFtsQuery('Konstitutsiya OR "qonun"')).toBe(
      '"konstitutsiya" AND "or" AND "qonun"',
    );
  });

  it("never promotes metadata-only records into AI prompt context", () => {
    const context = legalContextForPrompt([
      {
        body: "Metadata title",
        citation: {
          documentId: "d1",
          documentTitle: "Document",
          documentNumber: null,
          authority: "judicial_practice",
          provision: null,
          version: "v1",
          effectiveFrom: null,
          effectiveTo: null,
          verifiedAt: "2026-11-28T00:00:00.000Z",
          officialUrl: "https://sud.uz/document",
          completeness: "metadata_only",
        },
      },
    ]);
    expect(context).toContain("TEKSHIRILGAN HUQUQIY MANBA TOPILMADI");
    expect(semanticSearchState()).toMatchObject({ status: "blocked", fallback: "d1_fts5" });
  });
});
