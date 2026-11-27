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
    version: "0.3.0",
    description: "Development Stage 03 backend foundation contract.",
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
        operationId: "getAccountBoundary",
        security: [{ session: [] }],
        responses: { "401": errorResponse("Authentication is not implemented in Stage 03") },
      },
    },
  },
  components: {
    securitySchemes: {
      session: {
        type: "apiKey",
        in: "cookie",
        name: "__Host-yuristim_session",
        description: "Stage 04 Telegram-authenticated session; unavailable in Stage 03.",
      },
    },
  },
} as const;
