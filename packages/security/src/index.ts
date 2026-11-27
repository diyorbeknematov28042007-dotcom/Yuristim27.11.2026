import { AppError } from "@yuristim/errors";

export type AuthenticatedPrincipal = {
  accountId: string;
  roles: readonly string[];
  sessionId: string;
};

export type AuthenticationPort = {
  authenticate(request: Request): Promise<AuthenticatedPrincipal | null>;
};

export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

export type RateLimiterPort = {
  check(key: string, policy: string): Promise<RateLimitDecision>;
};

export const requireAuthentication = (
  principal: AuthenticatedPrincipal | null,
): AuthenticatedPrincipal => {
  if (principal === null) throw new AppError("UNAUTHORIZED", "Authentication required");
  return principal;
};

export const requireAnyRole = (
  principal: AuthenticatedPrincipal,
  allowedRoles: readonly string[],
): void => {
  if (!principal.roles.some((role) => allowedRoles.includes(role))) {
    throw new AppError("FORBIDDEN", "Insufficient permissions");
  }
};

export const enforceFeatureFlag = (enabled: boolean): void => {
  if (!enabled) throw new AppError("FEATURE_DISABLED", "Feature is disabled");
};

export const enforceRateLimit = (decision: RateLimitDecision): void => {
  if (!decision.allowed) {
    throw new AppError("RATE_LIMITED", "Too many requests", {
      details:
        decision.retryAfterSeconds === undefined
          ? undefined
          : { retryAfterSeconds: decision.retryAfterSeconds },
    });
  }
};

export const isAllowedOrigin = (origin: string, allowlist: ReadonlySet<string>): boolean =>
  allowlist.has(origin);

export const secureResponseHeaders: Readonly<Record<string, string>> = {
  "cache-control": "no-store",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-site",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

export type TelegramInitDataVerifierPort = {
  verify(input: { initData: string; now: Date }): Promise<{
    telegramUserId: string;
    authDate: Date;
    replayKey: string;
  }>;
};

export type SessionManagerPort = {
  createSession(accountId: string): Promise<{ sessionId: string; expiresAt: Date }>;
  revokeSession(sessionId: string): Promise<void>;
};

export type AdminTotpVerifierPort = {
  verify(accountId: string, code: string): Promise<boolean>;
};
