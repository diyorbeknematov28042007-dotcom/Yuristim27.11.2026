import { D1AccountRepository } from "@yuristim/database";
import { AppError } from "@yuristim/errors";
import {
  csrfCookieName,
  enforceCsrf,
  parseCookieHeader,
  requireAnyRole,
  secureCookie,
  sessionCookieName,
  sha256Hex,
} from "@yuristim/security";
import type { Context, MiddlewareHandler } from "hono";
import type { AppBindings } from "../types";

const repositoryFor = (context: Context<AppBindings>): D1AccountRepository => {
  const config = context.get("config");
  if (config === undefined) throw new AppError("SERVICE_UNAVAILABLE", "Configuration unavailable");
  return new D1AccountRepository(context.env.DB, {
    timeoutMs: config.REQUEST_TIMEOUT_MS,
    signal: context.req.raw.signal,
  });
};

export const sessionAuthenticationMiddleware: MiddlewareHandler<AppBindings> = async (
  context,
  next,
) => {
  const authorization = context.req.header("authorization");
  const cookies = parseCookieHeader(context.req.header("cookie"));
  const bearer = authorization?.match(/^Bearer ([A-Za-z0-9_-]{32,})$/u)?.[1];
  const cookieToken = cookies.get(sessionCookieName);
  const token = bearer ?? cookieToken;
  if (token === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");

  const now = new Date();
  const repository = repositoryFor(context);
  const session = await repository.findSessionByTokenHash(
    await sha256Hex(token),
    now.toISOString(),
  );
  if (session === null) throw new AppError("UNAUTHORIZED", "Session is invalid or expired");
  if (["suspended", "banned", "deletion_pending", "deleted"].includes(session.accountStatus)) {
    throw new AppError("FORBIDDEN", "Account is not active");
  }

  context.set("principal", {
    accountId: session.accountId,
    sessionId: session.id,
    roles: session.roles,
    accountStatus: session.accountStatus,
    csrfHash: session.csrfHash,
    platform: session.platform,
    adminVerifiedAt: session.adminVerifiedAt,
  });
  context.set("sessionToken", token);
  context.set("credentialSource", bearer === undefined ? "cookie" : "bearer");
  const csrfToken = cookies.get(csrfCookieName);
  if (csrfToken !== undefined) context.set("csrfToken", csrfToken);

  const config = context.get("config");
  if (config === undefined) throw new AppError("SERVICE_UNAVAILABLE", "Configuration unavailable");
  const renewableAt = now.getTime() + Math.floor(config.SESSION_TTL_SECONDS / 2) * 1_000;
  const shouldRenew = new Date(session.expiresAt).getTime() <= renewableAt;
  const renewedExpiry = shouldRenew
    ? new Date(now.getTime() + config.SESSION_TTL_SECONDS * 1_000).toISOString()
    : undefined;
  await repository.touchSession(session.id, now.toISOString(), renewedExpiry);

  await next();

  if (shouldRenew && bearer === undefined && renewedExpiry !== undefined) {
    context.header(
      "set-cookie",
      secureCookie(sessionCookieName, token, {
        httpOnly: true,
        maxAgeSeconds: config.SESSION_TTL_SECONDS,
      }),
      { append: true },
    );
    if (csrfToken !== undefined) {
      context.header(
        "set-cookie",
        secureCookie(csrfCookieName, csrfToken, {
          httpOnly: false,
          maxAgeSeconds: config.SESSION_TTL_SECONDS,
        }),
        { append: true },
      );
    }
  }
};

export const csrfMiddleware: MiddlewareHandler<AppBindings> = async (context, next) => {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(context.req.method) &&
    context.get("credentialSource") === "cookie"
  ) {
    const principal = context.get("principal");
    if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
    await enforceCsrf({
      cookieToken: context.get("csrfToken"),
      headerToken: context.req.header("x-csrf-token"),
      expectedHash: principal.csrfHash ?? null,
    });
  }
  await next();
};

export const activeAccountMiddleware: MiddlewareHandler<AppBindings> = async (context, next) => {
  const principal = context.get("principal");
  if (principal?.accountStatus !== "active") {
    throw new AppError("FORBIDDEN", "Account is restricted");
  }
  await next();
};

export const adminRoleMiddleware: MiddlewareHandler<AppBindings> = async (context, next) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  requireAnyRole(principal, ["owner", "super_admin", "admin", "moderator", "support"]);
  await next();
};

export const adminTotpMiddleware: MiddlewareHandler<AppBindings> = async (context, next) => {
  const principal = context.get("principal");
  if (principal?.adminVerifiedAt === undefined || principal.adminVerifiedAt === null) {
    throw new AppError("FORBIDDEN", "Admin TOTP verification required");
  }
  const verifiedAt = new Date(principal.adminVerifiedAt).getTime();
  if (!Number.isFinite(verifiedAt) || Date.now() - verifiedAt > 12 * 60 * 60 * 1_000) {
    throw new AppError("FORBIDDEN", "Admin TOTP verification expired");
  }
  await next();
};
