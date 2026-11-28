import { D1FeatureFlagRepository, D1LegalKnowledgeRepository } from "@yuristim/database";
import { AppError } from "@yuristim/errors";
import { assertOfficialLegalUrl, legalContextForPrompt } from "@yuristim/knowledge";
import { enforceFeatureFlag, sha256Hex } from "@yuristim/security";
import type { Context } from "hono";
import type { AppBindings } from "../types";

type LegalContext = Context<AppBindings>;

export const legalRepositoryFor = (context: LegalContext): D1LegalKnowledgeRepository => {
  const config = context.get("config");
  if (config === undefined) throw new AppError("SERVICE_UNAVAILABLE", "Configuration unavailable");
  return new D1LegalKnowledgeRepository(context.env.DB, {
    timeoutMs: config.REQUEST_TIMEOUT_MS,
    signal: context.req.raw.signal,
  });
};

export const enforceLegalSearch = async (context: LegalContext): Promise<void> => {
  const config = context.get("config");
  if (config === undefined) throw new AppError("SERVICE_UNAVAILABLE", "Configuration unavailable");
  const flags = new D1FeatureFlagRepository(context.env.DB, {
    timeoutMs: config.REQUEST_TIMEOUT_MS,
    signal: context.req.raw.signal,
  });
  enforceFeatureFlag(await flags.isEnabled("legal_knowledge_search"));
};

export const legalRetrievalForAI = async (
  context: LegalContext,
  query: string,
): Promise<{
  context: string;
  citations: Array<Awaited<ReturnType<D1LegalKnowledgeRepository["search"]>>[number]["citation"]>;
}> => {
  await enforceLegalSearch(context);
  let results: Awaited<ReturnType<D1LegalKnowledgeRepository["search"]>>;
  try {
    results = await legalRepositoryFor(context).search({
      query,
      asOf: new Date().toISOString(),
      limit: 5,
      includeMetadata: false,
    });
  } catch (error) {
    if (!(error instanceof AppError) || error.code !== "VALIDATION_ERROR") throw error;
    results = [];
  }
  return {
    context: legalContextForPrompt(results),
    citations: results.map((result) => result.citation),
  };
};

export type ManualVerifiedImportInput = {
  sourceId: string;
  externalId: string;
  title: string;
  documentNumber: string | null;
  documentType: string;
  legalAuthority: "normative" | "judicial_practice" | "official_guidance";
  language: string;
  adoptedAt: string | null;
  officialUrl: string;
  versionLabel: string;
  legalStatus: "current" | "historical" | "repealed" | "future";
  effectiveFrom: string | null;
  effectiveTo: string | null;
  publishedAt: string | null;
  completeness: "full" | "partial" | "metadata_only";
  provisions: Array<{
    kind: string;
    number: string | null;
    heading: string | null;
    body: string;
    path: string;
    ordinal: number;
  }>;
};

export const importManuallyVerified = async (
  context: LegalContext,
  input: ManualVerifiedImportInput,
): Promise<{ documentId: string; versionId: string; provisions: number }> => {
  const repository = legalRepositoryFor(context);
  const source = await repository.source(input.sourceId);
  if (source === null) throw new AppError("NOT_FOUND", "Legal source not found");
  const url = assertOfficialLegalUrl(input.officialUrl);
  if (url.hostname.toLowerCase() !== source.officialDomain.toLowerCase()) {
    throw new AppError("VALIDATION_ERROR", "Document URL does not match the selected source");
  }
  if (
    input.completeness === "metadata_only" &&
    input.provisions.some((item) => item.kind !== "metadata")
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Metadata-only imports may only contain metadata entries",
    );
  }
  if (
    input.completeness !== "metadata_only" &&
    input.provisions.every((item) => item.kind === "metadata")
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Legal text imports require at least one legal provision",
    );
  }
  const documentId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const hashedProvisions = await Promise.all(
    input.provisions.map(async (provision) => ({
      id: crypto.randomUUID(),
      ...provision,
      contentHash: await sha256Hex(provision.body),
    })),
  );
  const canonical = JSON.stringify({
    sourceId: input.sourceId,
    externalId: input.externalId,
    title: input.title,
    versionLabel: input.versionLabel,
    officialUrl: input.officialUrl,
    provisions: hashedProvisions.map((item) => ({ path: item.path, hash: item.contentHash })),
  });
  const now = new Date().toISOString();
  await repository.importVerified({
    sourceId: input.sourceId,
    document: {
      id: documentId,
      externalId: input.externalId,
      title: input.title,
      documentNumber: input.documentNumber,
      documentType: input.documentType,
      legalAuthority: input.legalAuthority,
      language: input.language,
      adoptedAt: input.adoptedAt,
      officialUrl: input.officialUrl,
    },
    version: {
      id: versionId,
      label: input.versionLabel,
      legalStatus: input.legalStatus,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      publishedAt: input.publishedAt,
      verifiedAt: now,
      completeness: input.completeness,
      sourceHash: await sha256Hex(input.officialUrl),
      contentHash: await sha256Hex(canonical),
    },
    provisions: hashedProvisions,
    runId: crypto.randomUUID(),
  });
  return { documentId, versionId, provisions: hashedProvisions.length };
};
