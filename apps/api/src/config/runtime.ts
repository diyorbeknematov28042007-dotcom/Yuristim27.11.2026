import { parseRuntimeConfig, type RuntimeConfig } from "@yuristim/config";

export const loadRuntimeConfig = (env: Env): RuntimeConfig =>
  parseRuntimeConfig({
    APP_ENV: env.APP_ENV,
    APP_VERSION: env.APP_VERSION,
    API_VERSION: env.API_VERSION,
    PUBLIC_BASE_URL: env.PUBLIC_BASE_URL,
    CORS_ALLOWLIST: env.CORS_ALLOWLIST,
    REQUEST_TIMEOUT_MS: env.REQUEST_TIMEOUT_MS,
    MAX_REQUEST_BYTES: env.MAX_REQUEST_BYTES,
    GIT_COMMIT_SHA: env.GIT_COMMIT_SHA,
  });
