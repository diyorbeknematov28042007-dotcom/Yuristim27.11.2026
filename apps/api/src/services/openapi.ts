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
    version: "0.7.0",
    description:
      "Development Stage 07 Yuristim AI, financial, authentication and account contract.",
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
    "/api/v1/financial/balance": {
      get: {
        operationId: "getCreditBalance",
        security: [{ sessionCookie: [] }, { bearerSession: [] }],
        responses: { "200": response("Server-authoritative credit balance", { type: "object" }) },
      },
    },
    "/api/v1/financial/ledger": {
      get: {
        operationId: "listFinancialLedger",
        security: [{ sessionCookie: [] }, { bearerSession: [] }],
        responses: { "200": response("Append-only ledger entries", { type: "object" }) },
      },
    },
    "/api/v1/financial/costs/estimate": {
      post: {
        operationId: "estimateFinancialCost",
        security: [{ sessionCookie: [] }, { bearerSession: [] }],
        responses: {
          "200": response("Versioned server-side cost estimate", { type: "object" }),
          "503": errorResponse("Cost is unknown or restricted"),
        },
      },
    },
    "/api/v1/financial/reservations": {
      post: {
        operationId: "reserveCredits",
        security: [{ sessionCookie: [] }, { bearerSession: [] }],
        parameters: [
          { in: "header", name: "Idempotency-Key", required: true, schema: { type: "string" } },
        ],
        responses: {
          "201": response("Credits reserved atomically", { type: "object" }),
          "402": errorResponse("Insufficient credits"),
          "409": errorResponse("Budget or idempotency conflict"),
        },
      },
    },
    "/api/v1/financial/payments/intents": {
      post: {
        operationId: "createPaymentIntent",
        security: [{ sessionCookie: [] }, { bearerSession: [] }],
        responses: { "403": errorResponse("Real payments are disabled") },
      },
    },
    "/api/v1/admin/financial/reconciliation": {
      post: {
        operationId: "runFinancialReconciliation",
        security: [{ sessionCookie: [] }, { bearerSession: [] }],
        responses: { "201": response("Financial reconciliation result", { type: "object" }) },
      },
    },
    "/api/v1/ai/models": {
      get: {
        operationId: "listAIModels",
        security: [{ sessionCookie: [] }, { bearerSession: [] }],
        responses: {
          "200": response("Lite and Pro availability without provider secrets", { type: "object" }),
          "401": errorResponse("Authentication required"),
        },
      },
    },
    "/api/v1/ai/conversations": {
      get: {
        operationId: "listAIConversations",
        security: [{ sessionCookie: [] }, { bearerSession: [] }],
        responses: { "200": response("Account-isolated AI conversations", { type: "object" }) },
      },
      post: {
        operationId: "createAIConversation",
        security: [{ sessionCookie: [] }, { bearerSession: [] }],
        responses: {
          "201": response("AI conversation created", { type: "object" }),
          "400": errorResponse("Invalid conversation options"),
        },
      },
    },
    "/api/v1/ai/conversations/{conversationId}/messages": {
      post: {
        operationId: "createAIMessage",
        security: [{ sessionCookie: [] }, { bearerSession: [] }],
        parameters: [
          { in: "path", name: "conversationId", required: true, schema: { type: "string" } },
          { in: "header", name: "Idempotency-Key", required: true, schema: { type: "string" } },
        ],
        responses: {
          "201": response("AI result settled against Financial Core", { type: "object" }),
          "402": errorResponse("Insufficient credits"),
          "403": errorResponse("AI execution disabled"),
          "503": errorResponse("Provider, pricing or usage unavailable"),
        },
      },
    },
    "/api/v1/ai/conversations/{conversationId}/stream": {
      post: {
        operationId: "streamAIMessage",
        security: [{ sessionCookie: [] }, { bearerSession: [] }],
        parameters: [
          { in: "path", name: "conversationId", required: true, schema: { type: "string" } },
          { in: "header", name: "Idempotency-Key", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "SSE stream; final event records verified provider usage and settlement",
            content: { "text/event-stream": { schema: { type: "string" } } },
          },
          "503": errorResponse("Provider or pricing unavailable"),
        },
      },
    },
    "/api/v1/ai/memory": {
      get: {
        operationId: "listAIMemories",
        security: [{ sessionCookie: [] }, { bearerSession: [] }],
        responses: { "200": response("Consent-bound memories", { type: "object" }) },
      },
      post: {
        operationId: "createAIMemory",
        security: [{ sessionCookie: [] }, { bearerSession: [] }],
        responses: {
          "201": response("Consent-bound memory created", { type: "object" }),
          "400": errorResponse("Explicit consent missing"),
        },
      },
    },
    "/api/v1/ai/documents/upload": {
      post: {
        operationId: "uploadAIDocument",
        security: [{ sessionCookie: [] }, { bearerSession: [] }],
        responses: { "403": errorResponse("Private R2 storage is unavailable") },
      },
    },
    "/api/v1/admin/ai/models": {
      get: {
        operationId: "listAdminAIModels",
        security: [{ bearerSession: [] }],
        responses: {
          "200": response("Provider model registry", { type: "object" }),
          "403": errorResponse("Admin role and recent TOTP required"),
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
