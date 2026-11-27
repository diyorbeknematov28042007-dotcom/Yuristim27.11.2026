import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "../types";

export const requestContextMiddleware: MiddlewareHandler<AppBindings> = async (context, next) => {
  const requestId = crypto.randomUUID();
  context.set("requestId", requestId);
  context.set("startedAt", performance.now());
  context.header("x-request-id", requestId);
  await next();
};
