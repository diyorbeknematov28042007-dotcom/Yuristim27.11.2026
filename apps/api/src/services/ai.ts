import {
  assertSafeUserContent,
  createProviderAdapter,
  parseProviderSseEvent,
  safetyNotice,
  sseFrame,
  type AIMessage,
  type GenerationResult,
} from "@yuristim/ai";
import { successResponse } from "@yuristim/contracts";
import { D1AIRepository, D1FeatureFlagRepository } from "@yuristim/database";
import { AppError } from "@yuristim/errors";
import { enforceFeatureFlag, sha256Hex } from "@yuristim/security";
import type { VerifiedLegalCitation } from "@yuristim/knowledge";
import type { Context } from "hono";
import { financialRepositoryFor } from "./financial";
import { legalRetrievalForAI } from "./legal";
import type { AppBindings } from "../types";

type AIContext = Context<AppBindings>;

export const aiRepositoryFor = (context: AIContext): D1AIRepository => {
  const config = context.get("config");
  if (config === undefined) throw new AppError("SERVICE_UNAVAILABLE", "Configuration unavailable");
  return new D1AIRepository(context.env.DB, {
    timeoutMs: config.REQUEST_TIMEOUT_MS,
    signal: context.req.raw.signal,
  });
};

const principalOf = (context: AIContext) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  return principal;
};

const providerFor = (context: AIContext, provider: "google" | "openai") =>
  createProviderAdapter({
    provider,
    ...(context.env.GEMINI_API_KEY === undefined
      ? {}
      : { googleApiKey: context.env.GEMINI_API_KEY }),
    ...(context.env.OPENAI_API_KEY === undefined
      ? {}
      : { openAIApiKey: context.env.OPENAI_API_KEY }),
    ...(context.env.GEMINI_API_BASE_URL === undefined
      ? {}
      : { googleBaseUrl: context.env.GEMINI_API_BASE_URL }),
    ...(context.env.OPENAI_API_BASE_URL === undefined
      ? {}
      : { openAIBaseUrl: context.env.OPENAI_API_BASE_URL }),
  });

const executionAllowed = async (context: AIContext): Promise<void> => {
  const config = context.get("config");
  if (config === undefined) throw new AppError("SERVICE_UNAVAILABLE", "Configuration unavailable");
  const flags = new D1FeatureFlagRepository(context.env.DB, {
    timeoutMs: config.REQUEST_TIMEOUT_MS,
    signal: context.req.raw.signal,
  });
  enforceFeatureFlag(await flags.isEnabled("ai_provider_execution"));
};

const historyFor = async (
  repository: D1AIRepository,
  accountId: string,
  conversationId: string,
): Promise<AIMessage[]> => {
  const rows = (await repository.messages(accountId, conversationId, 24)) as Array<{
    role: "user" | "assistant";
    content: string;
    status: string;
  }>;
  return rows
    .filter((row) => row.status === "completed")
    .slice(-20)
    .map(({ role, content }) => ({ role, content }));
};

type PreparedRun = {
  repository: D1AIRepository;
  financial: ReturnType<typeof financialRepositoryFor>;
  accountId: string;
  conversationId: string;
  runId: string;
  requestMessageId: string;
  reservationId: string;
  model: Awaited<ReturnType<D1AIRepository["modelConfiguration"]>>;
  prompt: Awaited<ReturnType<D1AIRepository["activePrompt"]>>;
  systemPrompt: string;
  citations: VerifiedLegalCitation[];
  messages: AIMessage[];
};

export const prepareRun = async (
  context: AIContext,
  input: {
    conversationId: string;
    content: string;
    maxMicrocredits: number;
    idempotencyKey: string;
  },
): Promise<PreparedRun> => {
  assertSafeUserContent(input.content);
  await executionAllowed(context);
  const principal = principalOf(context);
  const repository = aiRepositoryFor(context);
  const conversation = await repository.conversation(principal.accountId, input.conversationId);
  const model = await repository.modelConfiguration(conversation.modelName);
  if (!model.enabled) throw new AppError("FEATURE_DISABLED", `${model.modelName} is disabled`);
  const prompt = await repository.activePrompt(model.modelName);
  // Constructing the adapter here makes a missing provider secret fail before any credit is reserved.
  providerFor(context, model.provider);

  const priorMessages = await historyFor(repository, principal.accountId, input.conversationId);
  const messages = [...priorMessages, { role: "user" as const, content: input.content }];
  const legal = await legalRetrievalForAI(context, input.content);
  const systemPrompt = `${prompt.content}\n\nTEKSHIRILGAN HUQUQIY KONTEKST:\n${legal.context}\n\nFaqat berilgan tekshirilgan kontekstga tayangan iqtiboslarni manbasi bilan ko‘rsating. Kontekst yetarli bo‘lmasa, buni ochiq ayting.`;
  const estimatedInputUnits = Math.max(
    1,
    Math.ceil(
      (systemPrompt.length + messages.reduce((sum, item) => sum + item.content.length, 0)) / 4,
    ),
  );
  const estimatedUnits = estimatedInputUnits + model.maxOutputTokens;
  const financial = financialRepositoryFor(context);
  const now = new Date();
  await financial.expireDueCredits(now.toISOString());
  await financial.ensureWeeklyGrant(principal.accountId, now);
  const estimate = await financial.estimateCost(model.priceKey, estimatedUnits);
  const requestHash = await sha256Hex(
    JSON.stringify({
      accountId: principal.accountId,
      conversationId: input.conversationId,
      contentHash: await sha256Hex(input.content),
      modelName: model.modelName,
      modelConfigVersion: model.configVersion,
      promptVersion: prompt.version,
      legalCitations: legal.citations.map((citation) => ({
        documentId: citation.documentId,
        version: citation.version,
        provision: citation.provision,
      })),
      maxMicrocredits: input.maxMicrocredits,
    }),
  );
  const reservation = await financial.createReservation({
    accountId: principal.accountId,
    idempotencyKey: `ai:${input.idempotencyKey}`,
    requestHash,
    estimate,
    maxMicrocredits: input.maxMicrocredits,
    expiresAt: new Date(now.getTime() + 60 * 60 * 1_000).toISOString(),
    now: now.toISOString(),
  });
  const run = await repository.createRequest({
    accountId: principal.accountId,
    conversationId: input.conversationId,
    model,
    prompt,
    content: input.content,
    contentHash: await sha256Hex(input.content),
    idempotencyKey: input.idempotencyKey,
    requestHash,
    reservationId: reservation.id,
    now: now.toISOString(),
  });
  if (!run.created) {
    throw new AppError("CONFLICT", `AI request already exists with status ${run.status}`);
  }
  await repository.markRunRunning(principal.accountId, run.runId);
  return {
    repository,
    financial,
    accountId: principal.accountId,
    conversationId: input.conversationId,
    runId: run.runId,
    requestMessageId: run.messageId,
    reservationId: reservation.id,
    model,
    prompt,
    systemPrompt,
    citations: legal.citations,
    messages,
  };
};

const providerSignal = (
  requestSignal: AbortSignal,
  timeoutMs: number,
): { signal: AbortSignal; dispose: () => void } => {
  const controller = new AbortController();
  const onAbort = () => controller.abort(requestSignal.reason);
  requestSignal.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error("AI provider timeout")), timeoutMs);
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      requestSignal.removeEventListener("abort", onAbort);
    },
  };
};

const settleCompleted = async (
  run: PreparedRun,
  result: GenerationResult,
): Promise<{ messageId: string; chargedMicrocredits: number }> => {
  const actualUnits = result.inputUnits + result.outputUnits;
  if (actualUnits <= 0) {
    await run.repository.failRun({
      accountId: run.accountId,
      runId: run.runId,
      status: "reconciliation_required",
      errorCategory: "PROVIDER_USAGE_MISSING",
      now: new Date().toISOString(),
    });
    throw new AppError("SERVICE_UNAVAILABLE", "Provider usage requires reconciliation");
  }
  const now = new Date().toISOString();
  const settlement = await run.financial.settleReservation({
    reservationId: run.reservationId,
    accountId: run.accountId,
    actualUnits,
    consentToAdditionalCharge: false,
    idempotencyKey: `ai-settle:${run.runId}`,
    requestHash: await sha256Hex(
      JSON.stringify({
        runId: run.runId,
        actualUnits,
        providerResponseId: result.providerResponseId,
      }),
    ),
    now,
  });
  const content = `${result.text}\n\n${safetyNotice}`;
  const messageId = await run.repository.completeRun({
    accountId: run.accountId,
    runId: run.runId,
    conversationId: run.conversationId,
    parentMessageId: run.requestMessageId,
    content,
    contentHash: await sha256Hex(content),
    providerResponseId: result.providerResponseId,
    inputUnits: result.inputUnits,
    outputUnits: result.outputUnits,
    chargedMicrocredits: settlement.actualMicrocredits,
    now,
  });
  await run.repository.addVerifiedCitations(messageId, run.citations, now);
  return { messageId, chargedMicrocredits: settlement.actualMicrocredits };
};

const markProviderFailure = async (run: PreparedRun, error: unknown): Promise<void> => {
  await run.repository.failRun({
    accountId: run.accountId,
    runId: run.runId,
    status: "reconciliation_required",
    errorCategory: error instanceof AppError ? error.code : "PROVIDER_ERROR",
    now: new Date().toISOString(),
  });
};

export const executeRun = async (
  context: AIContext,
  input: {
    conversationId: string;
    content: string;
    maxMicrocredits: number;
    idempotencyKey: string;
  },
) => {
  const run = await prepareRun(context, input);
  const timeout = providerSignal(context.req.raw.signal, 25_000);
  try {
    const result = await providerFor(context, run.model.provider).generate({
      modelId: run.model.providerModelId,
      systemPrompt: run.systemPrompt,
      messages: run.messages,
      maxOutputTokens: run.model.maxOutputTokens,
      signal: timeout.signal,
    });
    const settled = await settleCompleted(run, result);
    return {
      runId: run.runId,
      messageId: settled.messageId,
      model: run.model.modelName,
      verificationStatus: "unverified" as const,
      citations: run.citations,
      content: `${result.text}\n\n${safetyNotice}`,
      usage: { inputUnits: result.inputUnits, outputUnits: result.outputUnits },
      chargedMicrocredits: settled.chargedMicrocredits,
    };
  } catch (error) {
    await markProviderFailure(run, error);
    throw error;
  } finally {
    timeout.dispose();
  }
};

const dataFromFrame = (frame: string): string | null => {
  const values = frame
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart());
  return values.length === 0 ? null : values.join("\n");
};

export const executeStream = async (
  context: AIContext,
  input: {
    conversationId: string;
    content: string;
    maxMicrocredits: number;
    idempotencyKey: string;
  },
): Promise<Response> => {
  const run = await prepareRun(context, input);
  if (!run.model.streamingEnabled) throw new AppError("FEATURE_DISABLED", "Streaming is disabled");
  const timeout = providerSignal(context.req.raw.signal, 25_000);
  let upstream: ReadableStream<Uint8Array>;
  try {
    upstream = await providerFor(context, run.model.provider).stream({
      modelId: run.model.providerModelId,
      systemPrompt: run.systemPrompt,
      messages: run.messages,
      maxOutputTokens: run.model.maxOutputTokens,
      signal: timeout.signal,
    });
  } catch (error) {
    timeout.dispose();
    await markProviderFailure(run, error);
    throw error;
  }
  const output = new TransformStream<Uint8Array, Uint8Array>();
  const writer = output.writable.getWriter();
  const pump = (async () => {
    const reader = upstream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let inputUnits = 0;
    let outputUnits = 0;
    let providerResponseId: string | null = null;
    let eventCount = 0;
    try {
      await writer.write(sseFrame("run", { runId: run.runId, model: run.model.modelName }));
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        buffer += decoder.decode(next.value, { stream: true });
        const frames = buffer.split(/\r?\n\r?\n/u);
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const data = dataFromFrame(frame);
          if (data === null) continue;
          const event = parseProviderSseEvent(run.model.provider, data);
          if (event?.type === "text_delta") {
            text += event.text;
            if (text.length > 100_000)
              throw new AppError("PAYLOAD_TOO_LARGE", "AI response is too large");
            await writer.write(sseFrame("delta", { text: event.text }));
          } else if (event?.type === "usage") {
            inputUnits = event.inputUnits;
            outputUnits = event.outputUnits;
            providerResponseId = event.providerResponseId;
          }
          eventCount += 1;
          if (
            eventCount % 16 === 0 &&
            (await run.repository.isCancellationRequested(run.accountId, run.runId))
          ) {
            await reader.cancel("cancelled_by_user");
            throw new AppError("CONFLICT", "AI response was cancelled");
          }
        }
      }
      const settled = await settleCompleted(run, {
        text,
        providerResponseId,
        inputUnits,
        outputUnits,
      });
      await writer.write(sseFrame("notice", { text: safetyNotice }));
      await writer.write(
        sseFrame("completed", {
          runId: run.runId,
          messageId: settled.messageId,
          verificationStatus: "unverified",
          citations: run.citations,
          chargedMicrocredits: settled.chargedMicrocredits,
        }),
      );
    } catch (error) {
      await markProviderFailure(run, error);
      try {
        await writer.write(
          sseFrame("error", {
            code: error instanceof AppError ? error.code : "SERVICE_UNAVAILABLE",
            message: "AI stream could not be completed",
          }),
        );
      } catch {
        // The client disconnected; never log or expose conversation content.
      }
    } finally {
      timeout.dispose();
      await writer.close().catch(() => undefined);
      reader.releaseLock();
    }
  })();
  context.executionCtx.waitUntil(pump);
  return new Response(output.readable, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-store",
      connection: "keep-alive",
      "x-accel-buffering": "no",
      "x-request-id": context.get("requestId"),
    },
  });
};

export const modelAvailability = async (context: AIContext) => {
  const models = await aiRepositoryFor(context).listModels();
  return Promise.all(
    models.map(async (model) => {
      const providerConfigured =
        model.provider === "google"
          ? Boolean(context.env.GEMINI_API_KEY)
          : Boolean(context.env.OPENAI_API_KEY);
      let pricingConfigured = false;
      try {
        await financialRepositoryFor(context).estimateCost(model.priceKey, 1);
        pricingConfigured = true;
      } catch (error) {
        if (!(error instanceof AppError) || error.code !== "SERVICE_UNAVAILABLE") throw error;
      }
      return {
        name: model.modelName,
        available: model.enabled && providerConfigured && pricingConfigured,
        providerConfigured,
        pricingConfigured,
        streaming: model.streamingEnabled,
        legalSourceVerification: "verified_d1_fts5",
      };
    }),
  );
};

export const jsonSuccess = (context: AIContext, data: unknown, status = 200): Response =>
  context.json(successResponse(data, context.get("requestId")), status as 200);
