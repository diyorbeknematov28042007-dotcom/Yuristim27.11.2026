import { AppError } from "@yuristim/errors";

export const officialLegalDomains = new Set(["lex.uz", "sud.uz"]);

export type LegalAuthority = "normative" | "judicial_practice" | "official_guidance";
export type LegalVersionStatus = "current" | "historical" | "repealed" | "future";
export type LegalCompleteness = "full" | "partial" | "metadata_only";

export type VerifiedLegalCitation = {
  documentId: string;
  documentTitle: string;
  documentNumber: string | null;
  authority: LegalAuthority;
  provision: string | null;
  version: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  verifiedAt: string;
  officialUrl: string;
  completeness: LegalCompleteness;
};

export const assertOfficialLegalUrl = (value: string): URL => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError("VALIDATION_ERROR", "Invalid official source URL");
  }
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== "" ||
    !officialLegalDomains.has(url.hostname.toLowerCase())
  ) {
    throw new AppError("FORBIDDEN", "Source URL is not in the official allowlist");
  }
  return url;
};

export const buildSafeFtsQuery = (input: string): string => {
  const tokens = input
    .normalize("NFKC")
    .toLocaleLowerCase("uz")
    .split(/[^\p{L}\p{N}ʻʼ’'-]+/u)
    .map((token) => token.replaceAll('"', "").trim())
    .filter((token) => token.length >= 2)
    .slice(0, 10);
  if (tokens.length === 0) throw new AppError("VALIDATION_ERROR", "Search query is empty");
  return tokens.map((token) => `"${token.replaceAll('"', '""')}"`).join(" AND ");
};

export const legalContextForPrompt = (
  results: ReadonlyArray<{ body: string; citation: VerifiedLegalCitation }>,
): string => {
  const usable = results.filter((result) => result.citation.completeness !== "metadata_only");
  if (usable.length === 0) {
    return "TEKSHIRILGAN HUQUQIY MANBA TOPILMADI. Huquqiy norma yoki iqtibosni o‘ylab topmang.";
  }
  return usable
    .slice(0, 5)
    .map(
      (result, index) =>
        `[YURISTIM-LEGAL-${index + 1}] ${result.citation.documentTitle}; ${result.citation.provision ?? "hujjat"}; tahrir: ${result.citation.version}; tekshirilgan: ${result.citation.verifiedAt}; URL: ${result.citation.officialUrl}\n${result.body}`,
    )
    .join("\n\n");
};

export type SemanticSearchState = {
  status: "blocked";
  reason: "vectorize_not_authorized";
  fallback: "d1_fts5";
};

export const semanticSearchState = (): SemanticSearchState => ({
  status: "blocked",
  reason: "vectorize_not_authorized",
  fallback: "d1_fts5",
});
