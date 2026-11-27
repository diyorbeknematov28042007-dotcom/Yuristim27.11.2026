import { successResponse } from "@yuristim/contracts";
import { AppError } from "@yuristim/errors";
import {
  clearCookie,
  createPkceChallenge,
  createTelegramOidcAuthorizationUrl,
  decryptJson,
  encryptJson,
  exchangeTelegramOidcCode,
  fetchTelegramJwks,
  loginStateCookieName,
  parseCookieHeader,
  randomToken,
  secureCookie,
  sha256Hex,
  verifyBotAdapterSignature,
  verifyStatePair,
  verifyTelegramMiniAppInitData,
  verifyTelegramOidcIdToken,
} from "@yuristim/security";
import { parseJsonBody, validateInput } from "@yuristim/validation";
import { Hono } from "hono";
import { z } from "zod";
import { csrfMiddleware, sessionAuthenticationMiddleware } from "../middleware/authentication";
import {
  attachBrowserSessionCookies,
  clearAuthenticationCookies,
  createIdentitySession,
  enforceAuthRateLimit,
  repositoryFor,
  requireSecret,
} from "../services/auth";
import type { AppBindings } from "../types";

const miniAppSchema = z.object({
  initData: z.string().min(20).max(16_384),
  deviceId: z.string().min(1).max(128).optional(),
  deviceName: z.string().min(1).max(128).optional(),
});

const oidcCallbackSchema = z.object({
  code: z.string().min(8).max(4_096),
  state: z.string().min(32).max(128),
  deviceId: z.string().min(1).max(128).optional(),
  deviceName: z.string().min(1).max(128).optional(),
});

const botIdentitySchema = z.object({
  telegramUserId: z
    .string()
    .regex(/^[1-9]\d{0,15}$/u)
    .refine(
      (value) => Number.isSafeInteger(Number(value)),
      "Telegram identity is outside safe range",
    ),
  username: z.string().min(1).max(64).optional(),
  displayName: z.string().min(1).max(128).optional(),
  languageCode: z.string().min(2).max(16).optional(),
  deviceName: z.string().min(1).max(128).optional(),
});

const recoveryCompleteSchema = z.object({
  recoveryCode: z.string().min(20).max(128),
  deviceId: z.string().min(1).max(128).optional(),
  deviceName: z.string().min(1).max(128).optional(),
});

export const authRoutes = new Hono<AppBindings>();

authRoutes.post("/telegram/mini-app", async (context) => {
  await enforceAuthRateLimit(context, "telegram_mini_app", 10, 300);
  const input = validateInput(miniAppSchema, await parseJsonBody(context.req.raw));
  const config = context.get("config");
  if (config === undefined) throw new AppError("SERVICE_UNAVAILABLE", "Configuration unavailable");
  const identity = await verifyTelegramMiniAppInitData({
    initData: input.initData,
    botToken: requireSecret(context.env.TELEGRAM_BOT_TOKEN, "Telegram bot token"),
    now: new Date(),
    maximumAgeSeconds: config.TELEGRAM_AUTH_MAX_AGE_SECONDS,
  });
  const session = await createIdentitySession(context, {
    identity,
    platform: "mini_app",
    replaySource: "mini_app",
    ...(input.deviceId === undefined ? {} : { deviceId: input.deviceId }),
    ...(input.deviceName === undefined ? {} : { deviceName: input.deviceName }),
  });
  attachBrowserSessionCookies(context, session);
  return context.json(
    successResponse(
      {
        accountId: session.accountId,
        onboardingRequired: !session.onboardingCompleted,
        expiresAt: session.expiresAt,
        csrfToken: session.csrfToken,
      },
      context.get("requestId"),
    ),
  );
});

authRoutes.post("/web/start", async (context) => {
  await enforceAuthRateLimit(context, "telegram_oidc_start", 20, 600);
  const clientId = requireSecret(context.env.TELEGRAM_OIDC_CLIENT_ID, "Telegram OIDC client ID");
  const redirectUri = requireSecret(
    context.env.TELEGRAM_OIDC_REDIRECT_URI,
    "Telegram OIDC redirect URI",
  );
  const encryptionKey = requireSecret(
    context.env.AUTH_ENCRYPTION_KEY,
    "Authentication encryption key",
  );
  const state = randomToken();
  const nonce = randomToken();
  const codeVerifier = randomToken(48);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1_000).toISOString();
  await repositoryFor(context).createChallenge({
    type: "oidc_login",
    tokenHash: await sha256Hex(state),
    secretCiphertext: await encryptJson({ codeVerifier, nonce }, encryptionKey),
    expiresAt,
  });
  context.header(
    "set-cookie",
    secureCookie(loginStateCookieName, state, {
      httpOnly: true,
      maxAgeSeconds: 600,
      sameSite: "Lax",
    }),
    { append: true },
  );
  return context.json(
    successResponse(
      {
        authorizationUrl: createTelegramOidcAuthorizationUrl({
          clientId,
          redirectUri,
          state,
          nonce,
          codeChallenge: await createPkceChallenge(codeVerifier),
        }),
        expiresAt,
      },
      context.get("requestId"),
    ),
  );
});

authRoutes.post("/web/callback", async (context) => {
  await enforceAuthRateLimit(context, "telegram_oidc_callback", 10, 300);
  const input = validateInput(oidcCallbackSchema, await parseJsonBody(context.req.raw));
  const cookieState = parseCookieHeader(context.req.header("cookie")).get(loginStateCookieName);
  if (cookieState === undefined) throw new AppError("FORBIDDEN", "Login state cookie is missing");
  verifyStatePair(cookieState, input.state);
  const challenge = await repositoryFor(context).consumeChallenge({
    type: "oidc_login",
    tokenHash: await sha256Hex(input.state),
    now: new Date().toISOString(),
  });
  if (challenge.secretCiphertext === null) {
    throw new AppError("UNAUTHORIZED", "Login challenge is invalid");
  }
  const encrypted = await decryptJson<{ codeVerifier: string; nonce: string }>(
    challenge.secretCiphertext,
    requireSecret(context.env.AUTH_ENCRYPTION_KEY, "Authentication encryption key"),
  );
  const clientId = requireSecret(context.env.TELEGRAM_OIDC_CLIENT_ID, "Telegram OIDC client ID");
  const idToken = await exchangeTelegramOidcCode({
    code: input.code,
    codeVerifier: encrypted.codeVerifier,
    clientId,
    clientSecret: requireSecret(
      context.env.TELEGRAM_OIDC_CLIENT_SECRET,
      "Telegram OIDC client secret",
    ),
    redirectUri: requireSecret(
      context.env.TELEGRAM_OIDC_REDIRECT_URI,
      "Telegram OIDC redirect URI",
    ),
  });
  const verified = await verifyTelegramOidcIdToken({
    idToken,
    jwks: await fetchTelegramJwks(),
    clientId,
    nonce: encrypted.nonce,
    now: new Date(),
  });
  const session = await createIdentitySession(context, {
    identity: {
      ...verified,
      authDate: new Date(),
    },
    platform: "web",
    replaySource: "web_oidc",
    ...(input.deviceId === undefined ? {} : { deviceId: input.deviceId }),
    ...(input.deviceName === undefined ? {} : { deviceName: input.deviceName }),
  });
  attachBrowserSessionCookies(context, session);
  context.header("set-cookie", clearCookie(loginStateCookieName, true), { append: true });
  return context.json(
    successResponse(
      {
        accountId: session.accountId,
        onboardingRequired: !session.onboardingCompleted,
        expiresAt: session.expiresAt,
        csrfToken: session.csrfToken,
      },
      context.get("requestId"),
    ),
  );
});

const parseAndVerifyBotBody = async <T>(
  context: Parameters<typeof repositoryFor>[0],
  schema: z.ZodType<T>,
): Promise<{ input: T; replayKey: string }> => {
  await enforceAuthRateLimit(context, "bot_adapter", 30, 60);
  const body = await context.req.text();
  const replayKey = await verifyBotAdapterSignature({
    body,
    timestamp: context.req.header("x-yuristim-bot-timestamp") ?? "",
    signature: context.req.header("x-yuristim-bot-signature") ?? "",
    secret: requireSecret(context.env.BOT_ADAPTER_SECRET, "Bot adapter secret"),
    now: new Date(),
  });
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (cause) {
    throw new AppError("VALIDATION_ERROR", "Invalid JSON request", { cause });
  }
  return { input: validateInput(schema, parsed), replayKey };
};

authRoutes.post("/telegram/bot/session", async (context) => {
  const { input, replayKey } = await parseAndVerifyBotBody(context, botIdentitySchema);
  const session = await createIdentitySession(context, {
    identity: {
      telegramUserId: input.telegramUserId,
      ...(input.username === undefined ? {} : { username: input.username }),
      ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
      ...(input.languageCode === undefined ? {} : { languageCode: input.languageCode }),
      authDate: new Date(),
      replayKey,
    },
    platform: "bot",
    replaySource: "bot_adapter",
    ...(input.deviceName === undefined ? {} : { deviceName: input.deviceName }),
  });
  return context.json(
    successResponse(
      {
        accountId: session.accountId,
        accessToken: session.sessionToken,
        expiresAt: session.expiresAt,
        onboardingRequired: !session.onboardingCompleted,
      },
      context.get("requestId"),
    ),
  );
});

authRoutes.post("/recovery/telegram/issue", async (context) => {
  const { input, replayKey } = await parseAndVerifyBotBody(
    context,
    botIdentitySchema.pick({ telegramUserId: true }),
  );
  await repositoryFor(context).consumeReplayNonce({
    nonceHash: await sha256Hex(replayKey),
    source: "bot_adapter",
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
  });
  const account = await repositoryFor(context).findAccountByTelegramUserId(input.telegramUserId);
  if (account === null || account.status !== "active") {
    throw new AppError("NOT_FOUND", "Recoverable account not found");
  }
  const recoveryCode = randomToken(24);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1_000).toISOString();
  const challengeId = await repositoryFor(context).createChallenge({
    type: "telegram_recovery",
    tokenHash: await sha256Hex(recoveryCode),
    accountId: account.id,
    expiresAt,
  });
  return context.json(
    successResponse({ challengeId, recoveryCode, expiresAt }, context.get("requestId")),
  );
});

authRoutes.post("/recovery/telegram/complete", async (context) => {
  await enforceAuthRateLimit(context, "telegram_recovery_complete", 5, 900);
  const input = validateInput(recoveryCompleteSchema, await parseJsonBody(context.req.raw));
  const challenge = await repositoryFor(context).consumeChallenge({
    type: "telegram_recovery",
    tokenHash: await sha256Hex(input.recoveryCode),
    now: new Date().toISOString(),
  });
  if (challenge.accountId === null)
    throw new AppError("UNAUTHORIZED", "Recovery challenge invalid");
  const account = await repositoryFor(context).getAccount(challenge.accountId);
  const session = await createIdentitySession(context, {
    identity: {
      telegramUserId: account.telegramUserId,
      ...(account.telegramUsername === null ? {} : { username: account.telegramUsername }),
      ...(account.telegramDisplayName === null ? {} : { displayName: account.telegramDisplayName }),
      ...(account.languageCode === null ? {} : { languageCode: account.languageCode }),
      authDate: new Date(),
      replayKey: `recovery:${input.recoveryCode}`,
    },
    platform: "web",
    replaySource: "recovery",
    ...(input.deviceId === undefined ? {} : { deviceId: input.deviceId }),
    ...(input.deviceName === undefined ? {} : { deviceName: input.deviceName }),
  });
  attachBrowserSessionCookies(context, session);
  await repositoryFor(context).recordSecurityEvent({
    accountId: account.id,
    sessionId: session.sessionId,
    eventType: "account_recovered_via_telegram",
    severity: "warning",
    requestId: context.get("requestId"),
  });
  return context.json(
    successResponse(
      { accountId: account.id, expiresAt: session.expiresAt, csrfToken: session.csrfToken },
      context.get("requestId"),
    ),
  );
});

export const authenticatedAuthRoutes = new Hono<AppBindings>();
authenticatedAuthRoutes.use("*", sessionAuthenticationMiddleware);
authenticatedAuthRoutes.use("*", csrfMiddleware);

authenticatedAuthRoutes.post("/logout", async (context) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  await repositoryFor(context).revokeSession(
    principal.sessionId,
    principal.accountId,
    "logout",
    new Date().toISOString(),
  );
  clearAuthenticationCookies(context);
  return context.json(successResponse({ loggedOut: true }, context.get("requestId")));
});

authenticatedAuthRoutes.post("/logout-all", async (context) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  await repositoryFor(context).revokeAllSessions(
    principal.accountId,
    "logout_all",
    new Date().toISOString(),
  );
  clearAuthenticationCookies(context);
  return context.json(
    successResponse({ loggedOut: true, allSessions: true }, context.get("requestId")),
  );
});
