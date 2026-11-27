import { successResponse } from "@yuristim/contracts";
import { AppError } from "@yuristim/errors";
import { decryptJson, encryptJson, generateTotpSecret, verifyTotpCode } from "@yuristim/security";
import { parseJsonBody, validateInput } from "@yuristim/validation";
import { Hono } from "hono";
import { z } from "zod";
import {
  adminRoleMiddleware,
  adminTotpMiddleware,
  csrfMiddleware,
  sessionAuthenticationMiddleware,
} from "../middleware/authentication";
import { enforceAuthRateLimit, repositoryFor, requireSecret } from "../services/auth";
import type { AppBindings } from "../types";

const totpCodeSchema = z.object({ code: z.string().regex(/^\d{6}$/u) });

const rolePermissions: Readonly<Record<string, readonly string[]>> = {
  owner: ["admin:*"],
  super_admin: ["users:read", "users:moderate", "support:manage", "security:read"],
  admin: ["users:read", "users:moderate", "support:manage"],
  moderator: ["users:read", "users:moderate"],
  support: ["users:read", "support:manage"],
};

export const adminRoutes = new Hono<AppBindings>();
adminRoutes.use("*", sessionAuthenticationMiddleware);
adminRoutes.use("*", csrfMiddleware);
adminRoutes.use("*", adminRoleMiddleware);

adminRoutes.post("/auth/totp/setup", async (context) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  const secret = generateTotpSecret();
  const now = new Date().toISOString();
  await repositoryFor(context).saveTotpCredential(
    principal.accountId,
    await encryptJson(
      { secret },
      requireSecret(context.env.AUTH_ENCRYPTION_KEY, "Authentication encryption key"),
    ),
    now,
  );
  const label = encodeURIComponent(`Yuristim:${principal.accountId}`);
  const uri = `otpauth://totp/${label}?secret=${secret}&issuer=Yuristim&algorithm=SHA1&digits=6&period=30`;
  return context.json(
    successResponse({ secret, otpauthUri: uri, confirmed: false }, context.get("requestId")),
    201,
  );
});

const verifyCredential = async (
  context: Parameters<typeof repositoryFor>[0],
  requireConfirmed: boolean,
): Promise<number> => {
  await enforceAuthRateLimit(context, "admin_totp", 5, 300);
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  const input = validateInput(totpCodeSchema, await parseJsonBody(context.req.raw));
  const credential = await repositoryFor(context).getTotpCredential(principal.accountId);
  if (credential === null || (requireConfirmed && credential.confirmedAt === null)) {
    throw new AppError("FORBIDDEN", "Admin TOTP is not configured");
  }
  const { secret } = await decryptJson<{ secret: string }>(
    credential.secretCiphertext,
    requireSecret(context.env.AUTH_ENCRYPTION_KEY, "Authentication encryption key"),
  );
  const step = await verifyTotpCode({
    secret,
    code: input.code,
    now: new Date(),
    lastUsedStep: credential.lastUsedStep,
  });
  if (step === null) throw new AppError("UNAUTHORIZED", "Invalid or replayed TOTP code");
  return step;
};

adminRoutes.post("/auth/totp/confirm", async (context) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  const step = await verifyCredential(context, false);
  const now = new Date().toISOString();
  await repositoryFor(context).confirmTotp(principal.accountId, step, now);
  await repositoryFor(context).markAdminSessionVerified(principal.sessionId, now);
  return context.json(
    successResponse({ confirmed: true, verifiedAt: now }, context.get("requestId")),
  );
});

adminRoutes.post("/auth/totp/verify", async (context) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  const step = await verifyCredential(context, true);
  const now = new Date().toISOString();
  await repositoryFor(context).confirmTotp(principal.accountId, step, now);
  await repositoryFor(context).markAdminSessionVerified(principal.sessionId, now);
  await repositoryFor(context).recordSecurityEvent({
    accountId: principal.accountId,
    sessionId: principal.sessionId,
    eventType: "admin_totp_verified",
    requestId: context.get("requestId"),
  });
  return context.json(
    successResponse({ verified: true, verifiedAt: now }, context.get("requestId")),
  );
});

adminRoutes.get("/auth/context", adminTotpMiddleware, (context) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  const permissions = new Set<string>();
  for (const role of principal.roles) {
    for (const permission of rolePermissions[role] ?? []) permissions.add(permission);
  }
  return context.json(
    successResponse(
      { accountId: principal.accountId, roles: principal.roles, permissions: [...permissions] },
      context.get("requestId"),
    ),
  );
});
