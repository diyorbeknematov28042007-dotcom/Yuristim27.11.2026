import {
  D1FeatureFlagRepository,
  D1LawyerRepository,
  type LawyerProfileInput,
} from "@yuristim/database";
import type { FeatureFlagKey } from "@yuristim/config";
import { AppError } from "@yuristim/errors";
import { enforceFeatureFlag, enforceRateLimit, sha256Hex } from "@yuristim/security";
import type { Context } from "hono";
import { repositoryFor as accountRepositoryFor } from "./auth";
import type { AppBindings } from "../types";

type LawyerContext = Context<AppBindings>;

export const lawyerRepositoryFor = (context: LawyerContext): D1LawyerRepository => {
  const config = context.get("config");
  if (config === undefined) throw new AppError("SERVICE_UNAVAILABLE", "Configuration unavailable");
  return new D1LawyerRepository(context.env.DB, {
    timeoutMs: config.REQUEST_TIMEOUT_MS,
    signal: context.req.raw.signal,
  });
};

export const enforceLawyerFeature = async (
  context: LawyerContext,
  key: Extract<
    FeatureFlagKey,
    "public_lawyer_registration" | "lawyer_directory" | "lawyer_recommendations"
  >,
): Promise<void> => {
  const config = context.get("config");
  if (config === undefined) throw new AppError("SERVICE_UNAVAILABLE", "Configuration unavailable");
  const enabled = await new D1FeatureFlagRepository(context.env.DB, {
    timeoutMs: config.REQUEST_TIMEOUT_MS,
    signal: context.req.raw.signal,
  }).isEnabled(key);
  enforceFeatureFlag(enabled);
};

export const enforceLawyerRateLimit = async (
  context: LawyerContext,
  scope: string,
  maximum: number,
): Promise<void> => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  const decision = await accountRepositoryFor(context).checkRateLimit({
    keyHash: await sha256Hex("lawyer:" + scope + ":" + principal.accountId),
    scope: "lawyer_" + scope,
    nowSeconds: Math.floor(Date.now() / 1_000),
    windowSeconds: 60,
    maximum,
  });
  enforceRateLimit(decision);
};

export const profileSlug = (fullName: string, id: string): string => {
  const normalized = fullName
    .normalize("NFKD")
    .toLocaleLowerCase("uz")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 48);
  return (normalized.length >= 3 ? normalized : "professional") + "-" + id.slice(0, 8);
};

export type { LawyerProfileInput };
