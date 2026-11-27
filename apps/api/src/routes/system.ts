import { publicPlatformConfig } from "@yuristim/config";
import { successResponse } from "@yuristim/contracts";
import { D1FeatureFlagRepository, assertDatabaseReady } from "@yuristim/database";
import { AppError } from "@yuristim/errors";
import { Hono } from "hono";
import { z } from "zod";
import { validateInput } from "@yuristim/validation";
import type { AppBindings } from "../types";
import { openApiDocument } from "../services/openapi";
import { withTimeout } from "../services/timeout";

const localeQuerySchema = z.object({ locale: z.enum(["uz", "ru", "en"]).default("uz") });

export const systemRoutes = new Hono<AppBindings>();

systemRoutes.get("/status", (context) => {
  const config = context.get("config");
  if (config === undefined) throw new AppError("SERVICE_UNAVAILABLE", "Configuration unavailable");
  return context.json(
    successResponse(
      {
        platform: "yuristim",
        stage: "backend_foundation",
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
  const flags = await new D1FeatureFlagRepository(context.env.DB).getAll();
  return context.json(
    successResponse(
      {
        ...publicPlatformConfig,
        capabilities: {
          aiExecution: flags.ai_provider_execution,
          researchExecution: flags.research_execution,
          realPayments: flags.real_payments,
          documentUploads: flags.document_uploads,
        },
      },
      context.get("requestId"),
    ),
  );
});

systemRoutes.get("/services", async (context) => {
  const query = validateInput(localeQuerySchema, context.req.query());
  const flags = await new D1FeatureFlagRepository(context.env.DB).getAll();
  return context.json(
    successResponse(
      {
        locale: query.locale,
        services: [
          { id: "foundation", name: "Backend Foundation", status: "available" },
          {
            id: "yuristim-ai",
            name: "Yuristim AI",
            status: flags.ai_provider_execution ? "coming_soon" : "disabled",
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
): Promise<void> => withTimeout(assertDatabaseReady(database), timeoutMs, signal);
