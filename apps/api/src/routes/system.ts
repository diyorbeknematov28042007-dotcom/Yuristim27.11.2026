import { publicPlatformConfig } from "@yuristim/config";
import { successResponse } from "@yuristim/contracts";
import { D1FeatureFlagRepository, assertDatabaseReady } from "@yuristim/database";
import { AppError } from "@yuristim/errors";
import { Hono } from "hono";
import { z } from "zod";
import { validateInput } from "@yuristim/validation";
import type { AppBindings } from "../types";
import { openApiDocument } from "../services/openapi";

const localeQuerySchema = z.object({ locale: z.enum(["uz", "ru", "en"]).default("uz") });

export const systemRoutes = new Hono<AppBindings>();

systemRoutes.get("/status", (context) => {
  const config = context.get("config");
  if (config === undefined) throw new AppError("SERVICE_UNAVAILABLE", "Configuration unavailable");
  return context.json(
    successResponse(
      {
        platform: "yuristim",
        stage: "legal_knowledge_base",
        status: "operational",
        environment: config.APP_ENV,
      },
      context.get("requestId"),
    ),
  );
});

systemRoutes.get("/version", (context) => {
  const config = context.get("config");
  if (config === undefined) throw new AppError("SERVICE_UNAVAILABLE", "Configuration unavailable");
  return context.json(
    successResponse(
      {
        application: config.APP_VERSION,
        api: config.API_VERSION,
        commit: config.GIT_COMMIT_SHA ?? "unavailable",
      },
      context.get("requestId"),
    ),
  );
});

systemRoutes.get("/config/public", async (context) => {
  const config = context.get("config");
  if (config === undefined) throw new AppError("SERVICE_UNAVAILABLE", "Configuration unavailable");
  const flags = await new D1FeatureFlagRepository(context.env.DB, {
    timeoutMs: config.REQUEST_TIMEOUT_MS,
    signal: context.req.raw.signal,
  }).getAll();
  return context.json(
    successResponse(
      {
        ...publicPlatformConfig,
        capabilities: {
          aiExecution: flags.ai_provider_execution,
          researchExecution: flags.research_execution,
          realPayments: flags.real_payments,
          documentUploads: flags.document_uploads,
          financialReservations: flags.financial_reservations,
          promoRedemption: flags.promo_redemption,
          referralRewards: flags.referral_rewards,
          creditPurchases: flags.credit_purchases,
          proSubscriptionPurchases: flags.pro_subscription_purchases,
          legalKnowledgeSearch: flags.legal_knowledge_search,
          legalSemanticSearch: flags.legal_semantic_search,
        },
      },
      context.get("requestId"),
    ),
  );
});

systemRoutes.get("/services", async (context) => {
  const query = validateInput(localeQuerySchema, context.req.query());
  const config = context.get("config");
  if (config === undefined) throw new AppError("SERVICE_UNAVAILABLE", "Configuration unavailable");
  const flags = await new D1FeatureFlagRepository(context.env.DB, {
    timeoutMs: config.REQUEST_TIMEOUT_MS,
    signal: context.req.raw.signal,
  }).getAll();
  const litePricing = await context.env.DB.prepare(
    `SELECT 1 AS configured FROM pricing_versions v
     JOIN pricing_items i ON i.version_id = v.id
     WHERE v.status = 'active' AND i.price_key = 'ai.google.gemini.total_token' LIMIT 1`,
  ).first<{ configured: number }>();
  return context.json(
    successResponse(
      {
        locale: query.locale,
        services: [
          { id: "foundation", name: "Backend Foundation", status: "available" },
          { id: "financial", name: "Financial Core", status: "available" },
          {
            id: "legal-knowledge",
            name: "Huquqiy bilimlar bazasi",
            status: flags.legal_knowledge_search ? "available" : "disabled",
          },
          {
            id: "yuristim-ai",
            name: "Yuristim AI",
            status:
              flags.ai_provider_execution &&
              context.env.GEMINI_API_KEY !== undefined &&
              litePricing?.configured === 1
                ? "available"
                : flags.ai_provider_execution
                  ? "coming_soon"
                  : "disabled",
          },
          {
            id: "research",
            name: "Yuridik izlanish",
            status: flags.research_execution ? "coming_soon" : "disabled",
          },
          { id: "lawyers", name: "Yurist topish", status: "coming_soon" },
          { id: "interactive", name: "Interaktiv xizmatlar", status: "coming_soon" },
          {
            id: "documents",
            name: "Hujjatlar",
            status: flags.document_uploads ? "coming_soon" : "disabled",
          },
          {
            id: "payments",
            name: "To‘lovlar",
            status: flags.real_payments ? "coming_soon" : "disabled",
          },
        ],
      },
      context.get("requestId"),
    ),
  );
});

systemRoutes.get("/openapi.json", (context) =>
  context.json(successResponse(openApiDocument, context.get("requestId"))),
);

export const readinessHandler = async (
  database: D1Database,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<void> => assertDatabaseReady(database, { timeoutMs, signal });
