import { successResponse } from "@yuristim/contracts";
import { AppError } from "@yuristim/errors";
import { requireAnyRole } from "@yuristim/security";
import { parseJsonBody, validateInput } from "@yuristim/validation";
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import {
  adminRoleMiddleware,
  adminTotpMiddleware,
  csrfMiddleware,
  sessionAuthenticationMiddleware,
} from "../middleware/authentication";
import { importManuallyVerified, legalRepositoryFor } from "../services/legal";
import type { AppBindings } from "../types";

const knowledgeAdmin: MiddlewareHandler<AppBindings> = async (context, next) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  requireAnyRole(principal, ["owner", "super_admin", "admin"]);
  await next();
};

const knowledgeMaintainer: MiddlewareHandler<AppBindings> = async (context, next) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  requireAnyRole(principal, ["owner", "super_admin"]);
  await next();
};

const nullableDate = z.string().datetime({ offset: true }).nullable();
const importSchema = z.object({
  sourceId: z.string().min(2).max(64),
  externalId: z.string().min(1).max(128),
  title: z.string().trim().min(3).max(500),
  documentNumber: z.string().trim().max(128).nullable(),
  documentType: z.enum([
    "constitution",
    "code",
    "law",
    "presidential_act",
    "cabinet_resolution",
    "plenum_resolution",
    "court_practice",
    "official_guidance",
    "other",
  ]),
  legalAuthority: z.enum(["normative", "judicial_practice", "official_guidance"]),
  language: z.enum(["uz-Latn", "uz-Cyrl", "ru", "en"]),
  adoptedAt: z.string().date().nullable(),
  officialUrl: z.string().url().max(2048),
  versionLabel: z.string().trim().min(1).max(128),
  legalStatus: z.enum(["current", "historical", "repealed", "future"]),
  effectiveFrom: nullableDate,
  effectiveTo: nullableDate,
  publishedAt: nullableDate,
  completeness: z.enum(["full", "partial", "metadata_only"]),
  provisions: z
    .array(
      z.object({
        kind: z.enum([
          "preamble",
          "section",
          "chapter",
          "article",
          "part",
          "clause",
          "paragraph",
          "metadata",
        ]),
        number: z.string().trim().max(64).nullable(),
        heading: z.string().trim().max(500).nullable(),
        body: z.string().trim().min(1).max(100_000),
        path: z.string().trim().min(1).max(500),
        ordinal: z.number().int().min(0).max(100_000),
      }),
    )
    .min(1)
    .max(20),
});

export const adminLegalRoutes = new Hono<AppBindings>();
adminLegalRoutes.use("*", sessionAuthenticationMiddleware);
adminLegalRoutes.use("*", csrfMiddleware);
adminLegalRoutes.use("*", adminRoleMiddleware);
adminLegalRoutes.use("*", adminTotpMiddleware);
adminLegalRoutes.use("*", knowledgeAdmin);

adminLegalRoutes.get("/sources", async (context) =>
  context.json(
    successResponse(
      { sources: await legalRepositoryFor(context).sources() },
      context.get("requestId"),
    ),
  ),
);

adminLegalRoutes.get("/ingestion-runs", async (context) =>
  context.json(
    successResponse(
      { runs: await legalRepositoryFor(context).ingestionRuns() },
      context.get("requestId"),
    ),
  ),
);

adminLegalRoutes.get("/quarantine", async (context) =>
  context.json(
    successResponse(
      { items: await legalRepositoryFor(context).quarantine() },
      context.get("requestId"),
    ),
  ),
);

adminLegalRoutes.post("/imports", knowledgeMaintainer, async (context) => {
  const input = validateInput(importSchema, await parseJsonBody(context.req.raw));
  const result = await importManuallyVerified(context, input);
  return context.json(successResponse(result, context.get("requestId")), 201);
});

adminLegalRoutes.post("/reindex", knowledgeMaintainer, async (context) => {
  const indexed = await legalRepositoryFor(context).reindex();
  return context.json(successResponse({ indexed }, context.get("requestId")));
});

adminLegalRoutes.post("/quarantine/:id/review", knowledgeMaintainer, async (context) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  const input = validateInput(
    z.object({ decision: z.enum(["approved", "rejected"]) }),
    await parseJsonBody(context.req.raw),
  );
  await legalRepositoryFor(context).reviewQuarantine({
    id: context.req.param("id"),
    decision: input.decision,
    actorAccountId: principal.accountId,
    now: new Date().toISOString(),
  });
  return context.json(successResponse({ reviewed: true }, context.get("requestId")));
});
