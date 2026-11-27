import { successResponse, errorResponse } from "@yuristim/contracts";
import { AppError } from "@yuristim/errors";
import { logger } from "@yuristim/logger";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import { requestLoggingMiddleware } from "./middleware/logging";
import { requestContextMiddleware } from "./middleware/request-context";
import { runtimeConfigMiddleware } from "./middleware/runtime-config";
import {
  corsMiddleware,
  requestSizeMiddleware,
  secureHeadersMiddleware,
} from "./middleware/security";
import { readinessHandler, systemRoutes } from "./routes/system";
import { authRoutes, authenticatedAuthRoutes } from "./routes/auth";
import { accountRoutes } from "./routes/account";
import { adminRoutes } from "./routes/admin";
import type { AppBindings } from "./types";

export const app = new Hono<AppBindings>();

app.use("*", requestContextMiddleware);
app.use("*", secureHeadersMiddleware);
app.use("*", requestSizeMiddleware);
app.use("*", requestLoggingMiddleware);

app.get("/health", (context) =>
  context.json(successResponse({ status: "ok" }, context.get("requestId"))),
);

app.use("/ready", runtimeConfigMiddleware);
app.get("/ready", async (context) => {
  const config = context.get("config");
  if (config === undefined) throw new AppError("SERVICE_UNAVAILABLE", "Configuration unavailable");
  await readinessHandler(context.env.DB, config.REQUEST_TIMEOUT_MS, context.req.raw.signal);
  return context.json(
    successResponse(
      { status: "ready", dependencies: { database: "available" } },
      context.get("requestId"),
    ),
  );
});

app.use("/api/*", runtimeConfigMiddleware);
app.use("/api/*", corsMiddleware);
app.route("/api/v1", systemRoutes);
app.route("/api/v1/auth", authRoutes);
app.route("/api/v1/auth", authenticatedAuthRoutes);
app.route("/api/v1/account", accountRoutes);
app.route("/api/v1/admin", adminRoutes);

const knownPaths = new Set([
  "/health",
  "/ready",
  "/api/v1/status",
  "/api/v1/version",
  "/api/v1/config/public",
  "/api/v1/services",
  "/api/v1/openapi.json",
  "/api/v1/account",
  "/api/v1/auth/telegram/mini-app",
  "/api/v1/auth/web/start",
  "/api/v1/auth/web/callback",
  "/api/v1/auth/telegram/bot/session",
  "/api/v1/auth/recovery/telegram/issue",
  "/api/v1/auth/recovery/telegram/complete",
  "/api/v1/auth/logout",
  "/api/v1/auth/logout-all",
  "/api/v1/account/onboarding",
  "/api/v1/account/profile",
  "/api/v1/account/consents",
  "/api/v1/account/sessions",
  "/api/v1/account/security-events",
  "/api/v1/account/export",
  "/api/v1/account/deletion",
  "/api/v1/account/financial-context",
  "/api/v1/admin/auth/totp/setup",
  "/api/v1/admin/auth/totp/confirm",
  "/api/v1/admin/auth/totp/verify",
  "/api/v1/admin/auth/context",
]);

app.notFound((context) => {
  const path = new URL(context.req.url).pathname;
  const requestId = context.get("requestId") ?? crypto.randomUUID();
  if (knownPaths.has(path)) {
    return context.json(errorResponse("METHOD_NOT_ALLOWED", "Method not allowed", requestId), 405);
  }
  return context.json(errorResponse("NOT_FOUND", "Resource not found", requestId), 404);
});

app.onError((error, context) => {
  const requestId = context.get("requestId") ?? crypto.randomUUID();
  let normalized: AppError;
  if (error instanceof AppError) normalized = error;
  else if (error instanceof ZodError) {
    normalized = new AppError("VALIDATION_ERROR", "Invalid request", {
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  } else {
    normalized = new AppError("INTERNAL_SERVER_ERROR", "Internal server error", {
      expose: false,
      cause: error,
    });
  }

  logger.error("http_error", {
    requestId,
    environment: context.env.APP_ENV ?? "invalid",
    method: context.req.method,
    route: new URL(context.req.url).pathname,
    statusCode: normalized.status,
    errorCategory: normalized.code,
  });

  const message = normalized.expose ? normalized.message : "Internal server error";
  const details = normalized.expose ? normalized.details : undefined;
  return context.json(
    errorResponse(normalized.code, message, requestId, details),
    normalized.status as ContentfulStatusCode,
  );
});

export default app;
