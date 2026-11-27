import { D1AccountRepository, type SessionPlatform } from "@yuristim/database";
import { AppError } from "@yuristim/errors";
import {
  clearCookie,
  csrfCookieName,
  enforceRateLimit,
  hmac,
  loginStateCookieName,
  randomToken,
  secureCookie,
  sessionCookieName,
  sha256Hex,
  toHex,
  type TelegramIdentity,
} from "@yuristim/security";
import type { Context } from "hono";
import type { AppBindings } from "../types";

export const repositoryFor = (context: Context<AppBindings>): D1AccountRepository => {
  const config = context.get("config");
  if (config === undefined) throw new AppError("SERVICE_UNAVAILABLE", "Configuration unavailable");
  return new D1AccountRepository(context.env.DB, {
    timeoutMs: config.REQUEST_TIMEOUT_MS,
    signal: context.req.raw.signal,
  });
};

export const requireSecret = (value: string | undefined, name: string): string => {
  if (value === undefined || value.length < 8) {
    throw new AppError("SERVICE_UNAVAILABLE", `${name} is not configured`);
  }
  return value;
};

export const enforceAuthRateLimit = async (
  context: Context<AppBindings>,
  scope: string,
  maximum: number,
  windowSeconds: number,
): Promise<void> => {
  const ip = context.req.header("cf-connecting-ip") ?? "unavailable";
  const privacyKey = requireSecret(
    context.env.AUTH_ENCRYPTION_KEY,
    "Authentication encryption key",
  );
  const decision = await repositoryFor(context).checkRateLimit({
    keyHash: toHex(await hmac("SHA-256", privacyKey, ip)),
    scope,
    nowSeconds: Math.floor(Date.now() / 1_000),
    windowSeconds,
    maximum,
  });
  enforceRateLimit(decision);
};

export type CreatedSession = {
  accountId: string;
  sessionId: string;
  sessionToken: string;
  csrfToken: string | null;
  expiresAt: string;
  onboardingCompleted: boolean;
};

export const createIdentitySession = async (
  context: Context<AppBindings>,
  input: {
    identity: TelegramIdentity;
    platform: SessionPlatform;
    deviceId?: string;
    deviceName?: string;
    replaySource: "mini_app" | "web_oidc" | "bot_adapter" | "recovery";
  },
): Promise<CreatedSession> => {
  const config = context.get("config");
  if (config === undefined) throw new AppError("SERVICE_UNAVAILABLE", "Configuration unavailable");
  const repository = repositoryFor(context);
  const now = new Date();
  const nowIso = now.toISOString();
  await repository.consumeReplayNonce({
    nonceHash: await sha256Hex(input.identity.replayKey),
    source: input.replaySource,
    expiresAt: new Date(now.getTime() + config.TELEGRAM_AUTH_MAX_AGE_SECONDS * 2_000).toISOString(),
  });
  const account = await repository.upsertTelegramAccount({
    telegramUserId: input.identity.telegramUserId,
    ...(input.identity.username === undefined ? {} : { username: input.identity.username }),
    ...(input.identity.displayName === undefined
      ? {}
      : { telegramDisplayName: input.identity.displayName }),
    ...(input.identity.languageCode === undefined
      ? {}
      : { languageCode: input.identity.languageCode }),
    now: nowIso,
  });
  if (
    context.env.OWNER_TELEGRAM_ID !== undefined &&
    context.env.OWNER_TELEGRAM_ID === input.identity.telegramUserId
  ) {
    await repository.grantRole(account.id, "owner");
  }

  const sessionToken = randomToken();
  const csrfToken = input.platform === "bot" ? null : randomToken();
  const expiresAt = new Date(now.getTime() + config.SESSION_TTL_SECONDS * 1_000).toISOString();
  const userAgent = context.req.header("user-agent");
  const ip = context.req.header("cf-connecting-ip");
  const privacyKey = requireSecret(
    context.env.AUTH_ENCRYPTION_KEY,
    "Authentication encryption key",
  );
  const sessionId = await repository.createSession({
    accountId: account.id,
    tokenHash: await sha256Hex(sessionToken),
    csrfHash: csrfToken === null ? null : await sha256Hex(csrfToken),
    platform: input.platform,
    ...(input.deviceId === undefined ? {} : { deviceId: input.deviceId }),
    ...(input.deviceName === undefined ? {} : { deviceName: input.deviceName }),
    ...(userAgent === undefined
      ? {}
      : { userAgentHash: toHex(await hmac("SHA-256", privacyKey, userAgent)) }),
    ...(ip === undefined ? {} : { ipHash: toHex(await hmac("SHA-256", privacyKey, ip)) }),
    expiresAt,
    now: nowIso,
  });
  await repository.recordSecurityEvent({
    accountId: account.id,
    sessionId,
    eventType: "new_device_session",
    requestId: context.get("requestId"),
    metadata: { platform: input.platform },
  });
  return {
    accountId: account.id,
    sessionId,
    sessionToken,
    csrfToken,
    expiresAt,
    onboardingCompleted: account.onboardingCompleted,
  };
};

export const attachBrowserSessionCookies = (
  context: Context<AppBindings>,
  session: CreatedSession,
): void => {
  const config = context.get("config");
  if (config === undefined || session.csrfToken === null) {
    throw new AppError("SERVICE_UNAVAILABLE", "Session configuration unavailable");
  }
  context.header(
    "set-cookie",
    secureCookie(sessionCookieName, session.sessionToken, {
      httpOnly: true,
      maxAgeSeconds: config.SESSION_TTL_SECONDS,
    }),
    { append: true },
  );
  context.header(
    "set-cookie",
    secureCookie(csrfCookieName, session.csrfToken, {
      httpOnly: false,
      maxAgeSeconds: config.SESSION_TTL_SECONDS,
    }),
    { append: true },
  );
};

export const clearAuthenticationCookies = (context: Context<AppBindings>): void => {
  context.header("set-cookie", clearCookie(sessionCookieName, true), { append: true });
  context.header("set-cookie", clearCookie(csrfCookieName, false), { append: true });
  context.header("set-cookie", clearCookie(loginStateCookieName, true), { append: true });
};
