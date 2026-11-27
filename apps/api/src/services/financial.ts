import { D1FinancialRepository } from "@yuristim/database";
import { AppError } from "@yuristim/errors";
import type { Context } from "hono";
import type { AppBindings } from "../types";

export const financialRepositoryFor = (context: Context<AppBindings>): D1FinancialRepository => {
  const config = context.get("config");
  if (config === undefined) throw new AppError("SERVICE_UNAVAILABLE", "Configuration unavailable");
  return new D1FinancialRepository(context.env.DB, {
    timeoutMs: config.REQUEST_TIMEOUT_MS,
    signal: context.req.raw.signal,
  });
};

export const requireIdempotencyKey = (context: Context<AppBindings>): string => {
  const key = context.req.header("idempotency-key");
  if (key === undefined || !/^[A-Za-z0-9:_-]{8,128}$/u.test(key)) {
    throw new AppError("VALIDATION_ERROR", "A valid Idempotency-Key header is required");
  }
  return key;
};
