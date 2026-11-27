import { successResponse } from "@yuristim/contracts";
import { AppError } from "@yuristim/errors";
import { parseJsonBody, validateInput } from "@yuristim/validation";
import { Hono } from "hono";
import { z } from "zod";
import {
  activeAccountMiddleware,
  csrfMiddleware,
  sessionAuthenticationMiddleware,
} from "../middleware/authentication";
import { clearAuthenticationCookies, repositoryFor } from "../services/auth";
import type { AppBindings } from "../types";

const onboardingSchema = z.object({
  displayName: z.string().trim().min(1).max(64),
});

const profileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(64).optional(),
    locale: z.enum(["uz", "ru", "en"]).optional(),
    notificationsEnabled: z.boolean().optional(),
    securityAlertsEnabled: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one field is required",
  });

const consentSchema = z.object({
  type: z.enum(["terms", "privacy", "marketing"]),
  version: z.string().trim().min(1).max(64),
  granted: z.boolean(),
});

const deletionSchema = z.object({ confirmation: z.literal("DELETE") });

export const accountRoutes = new Hono<AppBindings>();
accountRoutes.use("*", sessionAuthenticationMiddleware);
accountRoutes.use("*", csrfMiddleware);

accountRoutes.get("/", async (context) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  const account = await repositoryFor(context).getAccount(principal.accountId);
  return context.json(
    successResponse(
      {
        id: account.id,
        displayName: account.displayName,
        telegramDisplayName: account.telegramDisplayName,
        telegramUsername: account.telegramUsername,
        status: account.status,
        onboardingCompleted: account.onboardingCompleted,
        settings: {
          locale: account.locale,
          notificationsEnabled: account.notificationsEnabled,
          securityAlertsEnabled: account.securityAlertsEnabled,
        },
        createdAt: account.createdAt,
      },
      context.get("requestId"),
    ),
  );
});

accountRoutes.patch("/onboarding", activeAccountMiddleware, async (context) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  const input = validateInput(onboardingSchema, await parseJsonBody(context.req.raw));
  const account = await repositoryFor(context).completeOnboarding(
    principal.accountId,
    input.displayName,
    new Date().toISOString(),
  );
  await repositoryFor(context).recordSecurityEvent({
    accountId: principal.accountId,
    sessionId: principal.sessionId,
    eventType: "onboarding_completed",
    requestId: context.get("requestId"),
  });
  return context.json(
    successResponse(
      { displayName: account.displayName, onboardingCompleted: account.onboardingCompleted },
      context.get("requestId"),
    ),
  );
});

accountRoutes.patch("/profile", activeAccountMiddleware, async (context) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  const input = validateInput(profileSchema, await parseJsonBody(context.req.raw));
  const account = await repositoryFor(context).updateProfile({
    accountId: principal.accountId,
    ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
    ...(input.locale === undefined ? {} : { locale: input.locale }),
    ...(input.notificationsEnabled === undefined
      ? {}
      : { notificationsEnabled: input.notificationsEnabled }),
    ...(input.securityAlertsEnabled === undefined
      ? {}
      : { securityAlertsEnabled: input.securityAlertsEnabled }),
    now: new Date().toISOString(),
  });
  return context.json(
    successResponse(
      {
        displayName: account.displayName,
        locale: account.locale,
        notificationsEnabled: account.notificationsEnabled,
        securityAlertsEnabled: account.securityAlertsEnabled,
      },
      context.get("requestId"),
    ),
  );
});

accountRoutes.get("/consents", async (context) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  return context.json(
    successResponse(
      { consents: await repositoryFor(context).listConsents(principal.accountId) },
      context.get("requestId"),
    ),
  );
});

accountRoutes.post("/consents", activeAccountMiddleware, async (context) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  const input = validateInput(consentSchema, await parseJsonBody(context.req.raw));
  await repositoryFor(context).recordConsent({
    accountId: principal.accountId,
    ...input,
    now: new Date().toISOString(),
  });
  return context.json(successResponse({ recorded: true }, context.get("requestId")), 201);
});

accountRoutes.get("/sessions", async (context) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  const sessions = await repositoryFor(context).listSessions(principal.accountId);
  return context.json(
    successResponse({ sessions, currentSessionId: principal.sessionId }, context.get("requestId")),
  );
});

accountRoutes.delete("/sessions/:sessionId", async (context) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  const revoked = await repositoryFor(context).revokeSession(
    context.req.param("sessionId"),
    principal.accountId,
    "device_revoked",
    new Date().toISOString(),
  );
  if (!revoked) throw new AppError("NOT_FOUND", "Session not found");
  if (context.req.param("sessionId") === principal.sessionId) clearAuthenticationCookies(context);
  return context.json(successResponse({ revoked: true }, context.get("requestId")));
});

accountRoutes.get("/security-events", async (context) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  return context.json(
    successResponse(
      { events: await repositoryFor(context).listSecurityEvents(principal.accountId) },
      context.get("requestId"),
    ),
  );
});

accountRoutes.post("/export", activeAccountMiddleware, async (context) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  const requestId = await repositoryFor(context).createPrivacyRequest({
    accountId: principal.accountId,
    type: "export",
    status: "blocked_storage",
  });
  return context.json(
    successResponse(
      {
        requestId,
        status: "blocked_storage",
        executionEnabled: false,
        reason: "Private export storage is not enabled",
      },
      context.get("requestId"),
    ),
    202,
  );
});

accountRoutes.post("/deletion", activeAccountMiddleware, async (context) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  validateInput(deletionSchema, await parseJsonBody(context.req.raw));
  const requestId = await repositoryFor(context).createPrivacyRequest({
    accountId: principal.accountId,
    type: "deletion",
    status: "pending",
  });
  const now = new Date().toISOString();
  await repositoryFor(context).markDeletionPending(principal.accountId, now);
  await repositoryFor(context).recordSecurityEvent({
    accountId: principal.accountId,
    eventType: "account_deletion_requested",
    severity: "critical",
    requestId: context.get("requestId"),
  });
  clearAuthenticationCookies(context);
  return context.json(
    successResponse(
      {
        requestId,
        status: "pending",
        accountDisabled: true,
        irreversibleExecutionEnabled: false,
      },
      context.get("requestId"),
    ),
    202,
  );
});

accountRoutes.get("/financial-context", async (context) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  return context.json(
    successResponse(
      await repositoryFor(context).getFinancialIntegrationContext(principal.accountId),
      context.get("requestId"),
    ),
  );
});
