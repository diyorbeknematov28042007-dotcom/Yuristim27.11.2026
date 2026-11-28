import { assertSafeUserContent } from "@yuristim/ai";
import { successResponse } from "@yuristim/contracts";
import { enforceRateLimit, sha256Hex } from "@yuristim/security";
import { AppError } from "@yuristim/errors";
import { parseJsonBody, validateInput } from "@yuristim/validation";
import { Hono } from "hono";
import { z } from "zod";
import {
  activeAccountMiddleware,
  csrfMiddleware,
  sessionAuthenticationMiddleware,
} from "../middleware/authentication";
import { repositoryFor as accountRepositoryFor } from "../services/auth";
import { aiRepositoryFor, executeRun, executeStream, modelAvailability } from "../services/ai";
import { requireIdempotencyKey } from "../services/financial";
import type { AppBindings } from "../types";

const conversationSchema = z.object({
  model: z.enum(["Lite", "Pro"]),
  title: z.string().trim().min(1).max(120).default("Yangi suhbat"),
  temporary: z.boolean().default(false),
  memoryEnabled: z.boolean().default(false),
});

const updateConversationSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    status: z.enum(["active", "archived"]).optional(),
    memoryEnabled: z.boolean().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, "At least one change is required");

const generationSchema = z.object({
  content: z.string().trim().min(1).max(32_000),
  maxMicrocredits: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});

const editMessageSchema = z.object({ content: z.string().trim().min(1).max(32_000) });

const memorySchema = z.object({
  scope: z.enum(["global", "conversation", "professional_task"]),
  conversationId: z.uuid().optional(),
  content: z.string().trim().min(1).max(4_000),
  consent: z.literal(true),
  consentVersion: z.string().trim().min(1).max(64),
});

const documentSchema = z.object({
  conversationId: z.uuid().optional(),
  title: z.string().trim().min(1).max(255),
  content: z.string().trim().min(1).max(100_000),
});

export const aiRoutes = new Hono<AppBindings>();
aiRoutes.use("*", sessionAuthenticationMiddleware);
aiRoutes.use("*", csrfMiddleware);
aiRoutes.use("*", activeAccountMiddleware);

const principalOf = (context: Parameters<typeof aiRepositoryFor>[0]) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  return principal;
};

const enforceAIRateLimit = async (
  context: Parameters<typeof aiRepositoryFor>[0],
  scope: string,
  maximum: number,
  windowSeconds: number,
): Promise<void> => {
  const principal = principalOf(context);
  const now = Math.floor(Date.now() / 1_000);
  const decision = await accountRepositoryFor(context).checkRateLimit({
    keyHash: await sha256Hex(`ai:${principal.accountId}`),
    scope,
    nowSeconds: now,
    windowSeconds,
    maximum,
  });
  enforceRateLimit(decision);
};

aiRoutes.get("/models", async (context) =>
  context.json(
    successResponse({ models: await modelAvailability(context) }, context.get("requestId")),
  ),
);

aiRoutes.post("/conversations", async (context) => {
  await enforceAIRateLimit(context, "ai_conversation_create", 30, 60);
  const principal = principalOf(context);
  const input = validateInput(conversationSchema, await parseJsonBody(context.req.raw));
  if (input.temporary && input.memoryEnabled) {
    throw new AppError("VALIDATION_ERROR", "Temporary conversations cannot use persistent memory");
  }
  const conversation = await aiRepositoryFor(context).createConversation({
    accountId: principal.accountId,
    title: input.title,
    modelName: input.model,
    temporary: input.temporary,
    memoryEnabled: input.memoryEnabled,
    now: new Date().toISOString(),
  });
  return context.json(successResponse(conversation, context.get("requestId")), 201);
});

aiRoutes.get("/conversations", async (context) => {
  const principal = principalOf(context);
  const query = context.req.query("q")?.trim();
  if (query !== undefined && query.length > 120)
    throw new AppError("VALIDATION_ERROR", "Search is too long");
  const limit = Number(context.req.query("limit") ?? "50");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new AppError("VALIDATION_ERROR", "Invalid conversation limit");
  }
  return context.json(
    successResponse(
      {
        conversations: await aiRepositoryFor(context).listConversations(
          principal.accountId,
          query,
          limit,
        ),
      },
      context.get("requestId"),
    ),
  );
});

aiRoutes.get("/conversations/:conversationId", async (context) => {
  const principal = principalOf(context);
  const repository = aiRepositoryFor(context);
  const conversationId = context.req.param("conversationId");
  return context.json(
    successResponse(
      {
        conversation: await repository.conversation(principal.accountId, conversationId),
        messages: await repository.messages(principal.accountId, conversationId),
      },
      context.get("requestId"),
    ),
  );
});

aiRoutes.patch("/conversations/:conversationId", async (context) => {
  const principal = principalOf(context);
  const input = validateInput(updateConversationSchema, await parseJsonBody(context.req.raw));
  const conversation = await aiRepositoryFor(context).updateConversation({
    accountId: principal.accountId,
    id: context.req.param("conversationId"),
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(input.memoryEnabled === undefined ? {} : { memoryEnabled: input.memoryEnabled }),
    now: new Date().toISOString(),
  });
  return context.json(successResponse(conversation, context.get("requestId")));
});

aiRoutes.delete("/conversations/:conversationId", async (context) => {
  const principal = principalOf(context);
  await aiRepositoryFor(context).deleteConversation(
    principal.accountId,
    context.req.param("conversationId"),
    new Date().toISOString(),
  );
  return new Response(null, { status: 204 });
});

aiRoutes.post("/conversations/:conversationId/messages", async (context) => {
  await enforceAIRateLimit(context, "ai_generation", 20, 60);
  const input = validateInput(generationSchema, await parseJsonBody(context.req.raw));
  const result = await executeRun(context, {
    conversationId: context.req.param("conversationId"),
    content: input.content,
    maxMicrocredits: input.maxMicrocredits,
    idempotencyKey: requireIdempotencyKey(context),
  });
  return context.json(successResponse(result, context.get("requestId")), 201);
});

aiRoutes.post("/conversations/:conversationId/stream", async (context) => {
  await enforceAIRateLimit(context, "ai_stream", 10, 60);
  const input = validateInput(generationSchema, await parseJsonBody(context.req.raw));
  return executeStream(context, {
    conversationId: context.req.param("conversationId"),
    content: input.content,
    maxMicrocredits: input.maxMicrocredits,
    idempotencyKey: requireIdempotencyKey(context),
  });
});

aiRoutes.post("/runs/:runId/stop", async (context) => {
  const principal = principalOf(context);
  await aiRepositoryFor(context).requestCancellation(
    principal.accountId,
    context.req.param("runId"),
    new Date().toISOString(),
  );
  return context.json(
    successResponse(
      { runId: context.req.param("runId"), cancellation: "requested" },
      context.get("requestId"),
    ),
    202,
  );
});

aiRoutes.patch("/conversations/:conversationId/messages/:messageId", async (context) => {
  const principal = principalOf(context);
  const input = validateInput(editMessageSchema, await parseJsonBody(context.req.raw));
  assertSafeUserContent(input.content);
  const message = await aiRepositoryFor(context).editUserMessage({
    accountId: principal.accountId,
    conversationId: context.req.param("conversationId"),
    messageId: context.req.param("messageId"),
    content: input.content,
    contentHash: await sha256Hex(input.content),
    now: new Date().toISOString(),
  });
  return context.json(successResponse(message, context.get("requestId")));
});

aiRoutes.post("/conversations/:conversationId/messages/:messageId/regenerate", async (context) => {
  await enforceAIRateLimit(context, "ai_regeneration", 10, 60);
  const principal = principalOf(context);
  const input = validateInput(
    z.object({ maxMicrocredits: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }),
    await parseJsonBody(context.req.raw),
  );
  const original = await aiRepositoryFor(context).message(
    principal.accountId,
    context.req.param("conversationId"),
    context.req.param("messageId"),
  );
  if (original.role !== "user")
    throw new AppError("VALIDATION_ERROR", "A user message is required");
  const result = await executeRun(context, {
    conversationId: context.req.param("conversationId"),
    content: original.content,
    maxMicrocredits: input.maxMicrocredits,
    idempotencyKey: requireIdempotencyKey(context),
  });
  return context.json(successResponse(result, context.get("requestId")), 201);
});

aiRoutes.get("/memory", async (context) => {
  const principal = principalOf(context);
  return context.json(
    successResponse(
      { memories: await aiRepositoryFor(context).listMemories(principal.accountId) },
      context.get("requestId"),
    ),
  );
});

aiRoutes.post("/memory", async (context) => {
  const principal = principalOf(context);
  const input = validateInput(memorySchema, await parseJsonBody(context.req.raw));
  assertSafeUserContent(input.content);
  if (input.scope === "conversation" && input.conversationId === undefined) {
    throw new AppError("VALIDATION_ERROR", "conversationId is required for conversation memory");
  }
  const memory = await aiRepositoryFor(context).addMemory({
    accountId: principal.accountId,
    scope: input.scope,
    ...(input.conversationId === undefined ? {} : { conversationId: input.conversationId }),
    content: input.content,
    contentHash: await sha256Hex(input.content),
    consentVersion: input.consentVersion,
    now: new Date().toISOString(),
  });
  return context.json(successResponse(memory, context.get("requestId")), 201);
});

aiRoutes.delete("/memory/:memoryId", async (context) => {
  const principal = principalOf(context);
  await aiRepositoryFor(context).deleteMemory(
    principal.accountId,
    context.req.param("memoryId"),
    new Date().toISOString(),
  );
  return new Response(null, { status: 204 });
});

aiRoutes.get("/tools", (context) =>
  context.json(
    successResponse(
      {
        tools: [
          { key: "document_analysis", status: "blocked_storage" },
          { key: "document_comparison", status: "blocked_storage" },
          { key: "legal_source_lookup", status: "stage_08_pending" },
          { key: "deep_research", status: "stage_10_pending" },
        ],
        backgroundExecution: "blocked_queue_not_authorized",
      },
      context.get("requestId"),
    ),
  ),
);

aiRoutes.post("/documents/upload", () => {
  throw new AppError(
    "FEATURE_DISABLED",
    "Private file storage is unavailable because R2 is not enabled",
  );
});

aiRoutes.post("/documents/create", async (context) => {
  const principal = principalOf(context);
  const input = validateInput(documentSchema, await parseJsonBody(context.req.raw));
  assertSafeUserContent(input.content);
  const document = await aiRepositoryFor(context).createGeneratedDocument({
    accountId: principal.accountId,
    ...(input.conversationId === undefined ? {} : { conversationId: input.conversationId }),
    title: input.title,
    content: input.content,
    contentHash: await sha256Hex(input.content),
    now: new Date().toISOString(),
  });
  return context.json(successResponse(document, context.get("requestId")), 201);
});

aiRoutes.post("/documents/:documentId/export", () => {
  throw new AppError("FEATURE_DISABLED", "PDF and DOCX export requires private file storage");
});

aiRoutes.get("/voice/capabilities", (context) =>
  context.json(
    successResponse(
      {
        input: "provider_not_configured",
        readAloud: "provider_not_configured",
        liveVoice: "provider_not_configured",
      },
      context.get("requestId"),
    ),
  ),
);

aiRoutes.get("/legal-sources/status", (context) =>
  context.json(
    successResponse(
      { verification: "stage_08_pending", unverifiedAnswersAreLabeled: true },
      context.get("requestId"),
    ),
  ),
);
