import { AppError } from "@yuristim/errors";

export type AuthenticatedPrincipal = {
  accountId: string;
  roles: readonly string[];
  sessionId: string;
  accountStatus?: string;
  csrfHash?: string | null;
  platform?: "web" | "mini_app" | "bot" | "admin";
  adminVerifiedAt?: string | null;
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

export const constantTimeTextEqual = async (left: string, right: string): Promise<boolean> => {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(left)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index]! ^ rightBytes[index]!;
  }
  return difference === 0;
};

export const isAllowedOrigin = (origin: string, allowlist: ReadonlySet<string>): boolean =>
  allowlist.has(origin);

export const secureResponseHeaders: Readonly<Record<string, string>> = {
  "cache-control": "no-store",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "cross-origin-opener-policy": "same-origin-allow-popups",
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

export * from "./cookies";
export * from "./crypto";
export * from "./oidc";
export * from "./telegram";
export * from "./totp";
