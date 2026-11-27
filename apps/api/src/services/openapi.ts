const standardMeta = {
  type: "object",
  required: ["requestId"],
  properties: { requestId: { type: "string", format: "uuid" } },
} as const;

const errorSchema = {
  type: "object",
  required: ["success", "error", "meta"],
  properties: {
    success: { const: false },
    error: {
      type: "object",
      required: ["code", "message"],
      properties: { code: { type: "string" }, message: { type: "string" } },
    },
    meta: standardMeta,
  },
} as const;

const successEnvelope = (data: Record<string, unknown>): Record<string, unknown> => ({
  type: "object",
  required: ["success", "data", "meta"],
  properties: { success: { const: true }, data, meta: standardMeta },
});

const response = (description: string, data: Record<string, unknown>) => ({
  description,
  content: { "application/json": { schema: successEnvelope(data) } },
});

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: errorSchema } },
});

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Yuristim Backend API",
    version: "0.4.0",
    description: "Development Stage 04 Telegram-only authentication and account contract.",
  },
  servers: [
    {
      url: "https://yuristim-api-v3-staging.diyorbeknematov28042007.workers.dev",
      description: "V3 staging",
    },
  ],
  paths: {
    "/health": {
      get: {
        operationId: "getHealth",
        responses: { "200": response("Worker is live", { type: "object" }) },
      },
    },
    "/ready": {
      get: {
        operationId: "getReadiness",
        responses: {
          "200": response("Dependencies are ready", { type: "object" }),
          "503": errorResponse("A dependency is unavailable"),
        },
      },
    },
    "/api/v1/status": {
      get: {
        operationId: "getPlatformStatus",
        responses: { "200": response("Platform status", { type: "object" }) },
      },
    },
    "/api/v1/version": {
      get: {
        operationId: "getApiVersion",
        responses: { "200": response("API version", { type: "object" }) },
      },
    },
    "/api/v1/config/public": {
      get: {
        operationId: "getPublicConfig",
        responses: { "200": response("Safe public configuration", { type: "object" }) },
      },
    },
    "/api/v1/services": {
      get: {
        operationId: "getServices",
        parameters: [
          {
            in: "query",
            name: "locale",
            schema: { type: "string", enum: ["uz", "ru", "en"], default: "uz" },
          },
        ],
        responses: {
          "200": response("Service availability", { type: "object" }),
          "400": errorResponse("Invalid query"),
        },
      },
    },
    "/api/v1/openapi.json": {
      get: {
        operationId: "getOpenApi",
        responses: { "200": response("OpenAPI document", { type: "object" }) },
      },
    },
    "/api/v1/account": {
      get: {
        operationId: "getAccount",
        security: [{ sessionCookie: [] }, { bearerSession: [] }],
        responses: {
          "200": response("Current unified account", { type: "object" }),
          "401": errorResponse("Authentication required"),
        },
      },
    },
    "/api/v1/auth/telegram/mini-app": {
      post: {
        operationId: "authenticateTelegramMiniApp",
        responses: {
          "200": response("Authenticated Mini App session", { type: "object" }),
          "401": errorResponse("Invalid, expired or replayed initData"),
          "429": errorResponse("Authentication rate limit exceeded"),
          "503": errorResponse("Telegram credential is unavailable"),
        },
      },
    },
    "/api/v1/auth/web/start": {
      post: {
        operationId: "startTelegramWebAuthentication",
        responses: {
          "200": response("Telegram OIDC authorization with PKCE", { type: "object" }),
          "503": errorResponse("OIDC configuration is unavailable"),
        },
      },
    },
    "/api/v1/auth/web/callback": {
      post: {
        operationId: "completeTelegramWebAuthentication",
        responses: {
          "200": response("Authenticated web session", { type: "object" }),
          "401": errorResponse("Invalid Telegram authorization"),
          "403": errorResponse("State or CSRF validation failed"),
        },
      },
    },
    "/api/v1/auth/telegram/bot/session": {
      post: {
        operationId: "authenticateBotIdentity",
        description: "Trusted bot adapter request signed with timestamped HMAC.",
        responses: {
          "200": response("Authenticated bot session", { type: "object" }),
          "401": errorResponse("Invalid or replayed adapter request"),
        },
      },
    },
    "/api/v1/auth/recovery/telegram/complete": {
      post: {
        operationId: "completeTelegramRecovery",
        responses: {
          "200": response("Recovered web session", { type: "object" }),
          "401": errorResponse("Invalid, expired or consumed recovery challenge"),
        },
      },
    },
    "/api/v1/auth/logout": {
      post: {
        operationId: "logoutCurrentSession",
        security: [{ sessionCookie: [] }, { bearerSession: [] }],
        responses: {
          "200": response("Current session revoked", { type: "object" }),
          "401": errorResponse("Authentication required"),
          "403": errorResponse("CSRF validation failed"),
        },
      },
    },
    "/api/v1/account/onboarding": {
      patch: {
        operationId: "completeAccountOnboarding",
        security: [{ sessionCookie: [] }, { bearerSession: [] }],
        responses: {
          "200": response("Onboarding completed", { type: "object" }),
          "400": errorResponse("Invalid display name"),
          "401": errorResponse("Authentication required"),
        },
      },
    },
    "/api/v1/account/profile": {
      patch: {
        operationId: "updateAccountProfile",
        security: [{ sessionCookie: [] }, { bearerSession: [] }],
        responses: {
          "200": response("Profile updated", { type: "object" }),
          "400": errorResponse("Invalid profile update"),
        },
      },
    },
    "/api/v1/account/sessions": {
      get: {
        operationId: "listAccountSessions",
        security: [{ sessionCookie: [] }, { bearerSession: [] }],
        responses: { "200": response("Active account sessions", { type: "object" }) },
      },
    },
    "/api/v1/account/export": {
      post: {
        operationId: "requestAccountExport",
        security: [{ sessionCookie: [] }, { bearerSession: [] }],
        responses: {
          "202": response("Export request recorded; execution may be blocked", {
            type: "object",
          }),
        },
      },
    },
    "/api/v1/account/deletion": {
      post: {
        operationId: "requestAccountDeletion",
        security: [{ sessionCookie: [] }, { bearerSession: [] }],
        responses: {
          "202": response("Account disabled and deletion request recorded", {
            type: "object",
          }),
        },
      },
    },
    "/api/v1/account/financial-context": {
      get: {
        operationId: "getFinancialAccountContext",
        security: [{ sessionCookie: [] }, { bearerSession: [] }],
        responses: {
          "200": response("Stage 05 account eligibility contract", { type: "object" }),
        },
      },
    },
    "/api/v1/admin/auth/totp/setup": {
      post: {
        operationId: "setupAdminTotp",
        security: [{ sessionCookie: [] }, { bearerSession: [] }],
        responses: {
          "201": response("TOTP credential created for confirmation", { type: "object" }),
          "403": errorResponse("Admin role required"),
        },
      },
    },
    "/api/v1/admin/auth/context": {
      get: {
        operationId: "getAdminAuthorizationContext",
        security: [{ sessionCookie: [] }, { bearerSession: [] }],
        responses: {
          "200": response("Role and permission context", { type: "object" }),
          "403": errorResponse("Admin role and recent TOTP verification required"),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      sessionCookie: {
        type: "apiKey",
        in: "cookie",
        name: "__Host-yuristim_session",
        description: "HttpOnly, Secure, SameSite=Lax Telegram-authenticated session.",
      },
      bearerSession: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "opaque",
        description: "Opaque bot or trusted client session. Tokens are stored only as hashes.",
      },
    },
  },
} as const;
