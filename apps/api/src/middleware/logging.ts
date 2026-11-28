import { logger } from "@yuristim/logger";
import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "../types";

export const requestLoggingMiddleware: MiddlewareHandler<AppBindings> = async (context, next) => {
  await next();
  logger.info("http_request", {
    requestId: context.get("requestId"),
    environment: context.env.APP_ENV ?? "invalid",
    method: context.req.method,
    route: new URL(context.req.url).pathname,
    statusCode: context.res.status,
    durationMs: Math.round((performance.now() - context.get("startedAt")) * 100) / 100,
  });
};
