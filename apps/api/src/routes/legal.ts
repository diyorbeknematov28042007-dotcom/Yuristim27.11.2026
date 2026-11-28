import { successResponse } from "@yuristim/contracts";
import { AppError } from "@yuristim/errors";
import { semanticSearchState } from "@yuristim/knowledge";
import { enforceRateLimit, sha256Hex } from "@yuristim/security";
import { Hono } from "hono";
import {
  activeAccountMiddleware,
  csrfMiddleware,
  sessionAuthenticationMiddleware,
} from "../middleware/authentication";
import { repositoryFor as accountRepositoryFor } from "../services/auth";
import { enforceLegalSearch, legalRepositoryFor } from "../services/legal";
import type { AppBindings } from "../types";

const allowedDocumentTypes = new Set([
  "constitution",
  "code",
  "law",
  "presidential_act",
  "cabinet_resolution",
  "plenum_resolution",
  "court_practice",
  "official_guidance",
  "other",
]);

const parseAsOf = (value: string | undefined): string => {
  if (value === undefined) return new Date().toISOString();
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new AppError("VALIDATION_ERROR", "Invalid asOf date");
  return new Date(timestamp).toISOString();
};

export const legalRoutes = new Hono<AppBindings>();
legalRoutes.use("*", sessionAuthenticationMiddleware);
legalRoutes.use("*", csrfMiddleware);
legalRoutes.use("*", activeAccountMiddleware);

legalRoutes.get("/status", async (context) =>
  context.json(
    successResponse(
      {
        ...(await legalRepositoryFor(context).status()),
        lexicalSearch: "available_d1_fts5",
        semanticSearch: semanticSearchState(),
        automatedRemoteIngestion: "disabled_pending_source_access_approval",
      },
      context.get("requestId"),
    ),
  ),
);

legalRoutes.get("/search", async (context) => {
  await enforceLegalSearch(context);
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  const query = context.req.query("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 500) {
    throw new AppError("VALIDATION_ERROR", "Search query must contain 2 to 500 characters");
  }
  const documentType = context.req.query("documentType")?.trim();
  if (documentType !== undefined && !allowedDocumentTypes.has(documentType)) {
    throw new AppError("VALIDATION_ERROR", "Invalid document type");
  }
  const authority = context.req.query("authority")?.trim();
  if (
    authority !== undefined &&
    authority !== "normative" &&
    authority !== "judicial_practice" &&
    authority !== "official_guidance"
  ) {
    throw new AppError("VALIDATION_ERROR", "Invalid legal authority");
  }
  const limit = Number(context.req.query("limit") ?? "10");
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) {
    throw new AppError("VALIDATION_ERROR", "Invalid search limit");
  }
  const decision = await accountRepositoryFor(context).checkRateLimit({
    keyHash: await sha256Hex(`legal-search:${principal.accountId}`),
    scope: "legal_search",
    nowSeconds: Math.floor(Date.now() / 1_000),
    windowSeconds: 60,
    maximum: 30,
  });
  enforceRateLimit(decision);
  const results = await legalRepositoryFor(context).search({
    query,
    asOf: parseAsOf(context.req.query("asOf")),
    limit,
    ...(documentType === undefined ? {} : { documentType }),
    ...(authority === undefined ? {} : { authority }),
    includeMetadata: context.req.query("includeMetadata") === "true",
  });
  return context.json(
    successResponse(
      {
        query,
        results,
        semanticSearch: semanticSearchState(),
        verifiedOnly: true,
      },
      context.get("requestId"),
    ),
  );
});

legalRoutes.get("/documents/:documentId", async (context) =>
  context.json(
    successResponse(
      await legalRepositoryFor(context).document(
        context.req.param("documentId"),
        parseAsOf(context.req.query("asOf")),
      ),
      context.get("requestId"),
    ),
  ),
);
