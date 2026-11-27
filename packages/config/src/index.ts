import { z } from "zod";

export const featureFlagKeys = [
  "ai_provider_execution",
  "research_execution",
  "real_payments",
  "credit_purchases",
  "pro_subscription_purchases",
  "public_lawyer_registration",
  "document_uploads",
  "production_telegram_webhook",
] as const;

export type FeatureFlagKey = (typeof featureFlagKeys)[number];

const runtimeConfigSchema = z.object({
  APP_ENV: z.enum(["development", "staging", "production"]),
  APP_VERSION: z.string().regex(/^\d+\.\d+\.\d+$/),
  API_VERSION: z.literal("v1"),
  PUBLIC_BASE_URL: z.url(),
  CORS_ALLOWLIST: z.string(),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000),
  MAX_REQUEST_BYTES: z.coerce.number().int().min(1_024).max(10_485_760),
  GIT_COMMIT_SHA: z.string().max(64).optional(),
});

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema> & {
  corsAllowlist: ReadonlySet<string>;
};

export type RuntimeConfigInput = z.input<typeof runtimeConfigSchema>;

export const parseRuntimeConfig = (input: RuntimeConfigInput): RuntimeConfig => {
  const parsed = runtimeConfigSchema.parse(input);
  const origins = parsed.CORS_ALLOWLIST.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return { ...parsed, corsAllowlist: new Set(origins) };
};

export const publicPlatformConfig = {
  supportedLocales: ["uz", "ru", "en"],
  defaultLocale: "uz",
  timezone: "Asia/Tashkent",
  currency: "UZS",
  authentication: "telegram_only",
} as const;
