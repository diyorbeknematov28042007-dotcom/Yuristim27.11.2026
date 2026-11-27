import { AppError } from "@yuristim/errors";
import type { MiddlewareHandler } from "hono";
import { ZodError } from "zod";
import { loadRuntimeConfig } from "../config/runtime";
import type { AppBindings } from "../types";

export const runtimeConfigMiddleware: MiddlewareHandler<AppBindings> = async (context, next) => {
  try {
    context.set("config", loadRuntimeConfig(context.env));
  } catch (cause) {
    if (cause instanceof ZodError) {
      throw new AppError("SERVICE_UNAVAILABLE", "Runtime configuration is invalid", { cause });
    }
    throw cause;
  }
  await next();
};
