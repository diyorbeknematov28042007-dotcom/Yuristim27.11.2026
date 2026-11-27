import { AppError } from "@yuristim/errors";
import { isAllowedOrigin, secureResponseHeaders } from "@yuristim/security";
import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "../types";

export const secureHeadersMiddleware: MiddlewareHandler<AppBindings> = async (context, next) => {
  await next();
  for (const [name, value] of Object.entries(secureResponseHeaders)) context.header(name, value);
};

export const requestSizeMiddleware: MiddlewareHandler<AppBindings> = async (context, next) => {
  const configuredMaximum = Number(context.env.MAX_REQUEST_BYTES);
  const maximum = Number.isSafeInteger(configuredMaximum) ? configuredMaximum : 1_048_576;
  const contentLength = context.req.header("content-length");
  if (contentLength !== undefined) {
    const parsed = Number(contentLength);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new AppError("VALIDATION_ERROR", "Invalid Content-Length header");
    }
    if (parsed > maximum) throw new AppError("PAYLOAD_TOO_LARGE", "Request payload is too large");
  }

  const requestBody = context.req.raw.body;
  if (requestBody !== null) {
    const reader = requestBody.getReader();
    const chunks: Uint8Array[] = [];
    let bytesRead = 0;

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytesRead += value.byteLength;
        if (bytesRead > maximum) {
          await reader.cancel().catch(() => undefined);
          throw new AppError("PAYLOAD_TOO_LARGE", "Request payload is too large");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const headers = new Headers(context.req.raw.headers);
    headers.delete("content-length");
    headers.delete("transfer-encoding");
    const replayBody = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    });
    context.req.raw = new Request(context.req.raw, { body: replayBody, headers });
  }
  await next();
};

export const corsMiddleware: MiddlewareHandler<AppBindings> = async (context, next) => {
  const origin = context.req.header("origin");
  const config = context.get("config");
  if (config === undefined) throw new AppError("SERVICE_UNAVAILABLE", "Configuration unavailable");

  if (origin !== undefined) {
    if (!isAllowedOrigin(origin, config.corsAllowlist)) {
      throw new AppError("FORBIDDEN", "Origin is not allowed");
    }
    context.header("access-control-allow-origin", origin);
    context.header("vary", "Origin");
    context.header("access-control-allow-headers", "content-type, authorization, x-request-id");
    context.header("access-control-allow-methods", "GET, POST, PATCH, DELETE, HEAD, OPTIONS");
    context.header("access-control-max-age", "600");
  }

  if (context.req.method === "OPTIONS") {
    context.status(204);
    return;
  }
  await next();
};
