import type { RuntimeConfig } from "@yuristim/config";
import type { AuthenticatedPrincipal } from "@yuristim/security";

export type AppSecrets = {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_OIDC_CLIENT_ID?: string;
  TELEGRAM_OIDC_CLIENT_SECRET?: string;
  TELEGRAM_OIDC_REDIRECT_URI?: string;
  BOT_ADAPTER_SECRET?: string;
  AUTH_ENCRYPTION_KEY?: string;
  OWNER_TELEGRAM_ID?: string;
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_BASE_URL?: string;
  OPENAI_API_BASE_URL?: string;
  AI_OPS_PROBE_TOKEN?: string;
};

export type GatewayVariables = {
  requestId: string;
  startedAt: number;
  config?: RuntimeConfig;
  principal?: AuthenticatedPrincipal;
  sessionToken?: string;
  csrfToken?: string;
  renewSession?: boolean;
  credentialSource?: "cookie" | "bearer";
};

export type AppBindings = {
  Bindings: Env & AppSecrets;
  Variables: GatewayVariables;
};
