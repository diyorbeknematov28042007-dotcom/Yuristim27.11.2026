import { createProviderAdapter } from "@yuristim/ai";
import { successResponse } from "@yuristim/contracts";
import { constantTimeTextEqual, enforceRateLimit, sha256Hex } from "@yuristim/security";
import { AppError } from "@yuristim/errors";
import { Hono } from "hono";
import { aiRepositoryFor } from "../services/ai";
import { repositoryFor as accountRepositoryFor } from "../services/auth";
import type { AppBindings } from "../types";

export const opsAIRoutes = new Hono<AppBindings>();

opsAIRoutes.post("/gemini/probe", async (context) => {
  const config = context.get("config");
  if (config?.APP_ENV !== "staging") throw new AppError("NOT_FOUND", "Resource not found");
  const expected = context.env.AI_OPS_PROBE_TOKEN;
  const provided = context.req.header("x-yuristim-ops-token") ?? "";
  if (
    expected === undefined ||
    expected.length < 32 ||
    !(await constantTimeTextEqual(provided, expected))
  ) {
    throw new AppError("UNAUTHORIZED", "Operational probe authentication failed");
  }
  const decision = await accountRepositoryFor(context).checkRateLimit({
    keyHash: await sha256Hex("yuristim:gemini:ops-probe"),
    scope: "ai_ops_probe",
    nowSeconds: Math.floor(Date.now() / 1_000),
    windowSeconds: 900,
    maximum: 2,
  });
  enforceRateLimit(decision);
  const model = await aiRepositoryFor(context).modelConfiguration("Lite");
  if (!model.enabled || model.provider !== "google") {
    throw new AppError("FEATURE_DISABLED", "Lite provider is disabled");
  }
  const adapter = createProviderAdapter({
    provider: "google",
    ...(context.env.GEMINI_API_KEY === undefined
      ? {}
      : { googleApiKey: context.env.GEMINI_API_KEY }),
    ...(context.env.GEMINI_API_BASE_URL === undefined
      ? {}
      : { googleBaseUrl: context.env.GEMINI_API_BASE_URL }),
  });
  const result = await adapter.generate({
    modelId: model.providerModelId,
    systemPrompt: "Return only the exact operational health token requested by the user.",
    messages: [{ role: "user", content: "Return exactly: YURISTIM_LITE_OK" }],
    maxOutputTokens: 128,
    // Provider cold starts can exceed the ordinary user-path budget. This probe is
    // separately authenticated, rate-limited and has no financial side effects.
    signal: AbortSignal.any([context.req.raw.signal, AbortSignal.timeout(45_000)]),
  });
  if (result.text.trim() !== "YURISTIM_LITE_OK") {
    throw new AppError("SERVICE_UNAVAILABLE", "Lite provider returned an unexpected probe result");
  }
  return context.json(
    successResponse(
      {
        provider: "google",
        model: "Lite",
        status: "available",
        usage: { inputUnits: result.inputUnits, outputUnits: result.outputUnits },
      },
      context.get("requestId"),
    ),
  );
});
