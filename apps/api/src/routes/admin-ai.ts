import { successResponse } from "@yuristim/contracts";
import { AppError } from "@yuristim/errors";
import { requireAnyRole, sha256Hex } from "@yuristim/security";
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
import { aiRepositoryFor, modelAvailability } from "../services/ai";
import { repositoryFor as accountRepositoryFor } from "../services/auth";
import type { AppBindings } from "../types";

const aiAdmin: MiddlewareHandler<AppBindings> = async (context, next) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  requireAnyRole(principal, ["owner", "super_admin", "admin"]);
  await next();
};

const ownerOnly: MiddlewareHandler<AppBindings> = async (context, next) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  requireAnyRole(principal, ["owner"]);
  await next();
};

const modelSchema = z.object({
  providerModelId: z.string().trim().min(3).max(128),
  enabled: z.boolean(),
  streamingEnabled: z.boolean(),
  maxOutputTokens: z.number().int().min(1).max(32_768),
});

const promptSchema = z.object({
  promptKey: z.string().trim().min(1).max(64),
  version: z.number().int().positive(),
  model: z.enum(["Lite", "Pro"]),
  content: z.string().trim().min(32).max(20_000),
  activate: z.boolean().default(false),
});

export const adminAIRoutes = new Hono<AppBindings>();
adminAIRoutes.use("*", sessionAuthenticationMiddleware);
adminAIRoutes.use("*", csrfMiddleware);
adminAIRoutes.use("*", adminRoleMiddleware);
adminAIRoutes.use("*", adminTotpMiddleware);
adminAIRoutes.use("*", aiAdmin);

adminAIRoutes.get("/models", async (context) =>
  context.json(
    successResponse(
      {
        models: await aiRepositoryFor(context).listModels(),
        availability: await modelAvailability(context),
      },
      context.get("requestId"),
    ),
  ),
);

adminAIRoutes.patch("/models/:model", ownerOnly, async (context) => {
  const model = context.req.param("model");
  if (model !== "Lite" && model !== "Pro") throw new AppError("NOT_FOUND", "Model not found");
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  const input = validateInput(modelSchema, await parseJsonBody(context.req.raw));
  const updated = await aiRepositoryFor(context).updateModel({
    modelName: model,
    ...input,
    actorAccountId: principal.accountId,
    now: new Date().toISOString(),
  });
  return context.json(successResponse(updated, context.get("requestId")));
});

adminAIRoutes.post("/emergency-disable", ownerOnly, async (context) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  const input = validateInput(
    z.object({ model: z.enum(["Lite", "Pro"]), reason: z.string().trim().min(8).max(256) }),
    await parseJsonBody(context.req.raw),
  );
  const current = await aiRepositoryFor(context).modelConfiguration(input.model);
  const updated = await aiRepositoryFor(context).updateModel({
    modelName: input.model,
    providerModelId: current.providerModelId,
    enabled: false,
    streamingEnabled: current.streamingEnabled,
    maxOutputTokens: current.maxOutputTokens,
    actorAccountId: principal.accountId,
    now: new Date().toISOString(),
  });
  await accountRepositoryFor(context).recordSecurityEvent({
    accountId: principal.accountId,
    sessionId: principal.sessionId,
    eventType: "ai_emergency_disable",
    severity: "critical",
    requestId: context.get("requestId"),
    metadata: { model: input.model, reasonHash: await sha256Hex(input.reason) },
  });
  return context.json(
    successResponse(
      { model: updated, disabled: true, reasonRecorded: true },
      context.get("requestId"),
    ),
  );
});

adminAIRoutes.post("/prompts", ownerOnly, async (context) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  const input = validateInput(promptSchema, await parseJsonBody(context.req.raw));
  const result = await aiRepositoryFor(context).createPrompt({
    promptKey: input.promptKey,
    version: input.version,
    modelName: input.model,
    content: input.content,
    contentHash: await sha256Hex(input.content),
    actorAccountId: principal.accountId,
    activate: input.activate,
    now: new Date().toISOString(),
  });
  return context.json(successResponse(result, context.get("requestId")), 201);
});

adminAIRoutes.get("/usage", async (context) =>
  context.json(
    successResponse(
      { usage: await aiRepositoryFor(context).usageSummary() },
      context.get("requestId"),
    ),
  ),
);
