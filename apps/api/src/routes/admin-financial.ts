import { successResponse } from "@yuristim/contracts";
import { AppError } from "@yuristim/errors";
import { requireAnyRole, sha256Hex } from "@yuristim/security";
import { parseJsonBody, validateInput } from "@yuristim/validation";
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import {
  adminRoleMiddleware,
  adminTotpMiddleware,
  csrfMiddleware,
  sessionAuthenticationMiddleware,
} from "../middleware/authentication";
import { financialRepositoryFor, requireIdempotencyKey } from "../services/financial";
import type { AppBindings } from "../types";

const ownerOnly: MiddlewareHandler<AppBindings> = async (context, next) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  requireAnyRole(principal, ["owner"]);
  await next();
};

const financeAdmin: MiddlewareHandler<AppBindings> = async (context, next) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  requireAnyRole(principal, ["owner", "super_admin", "admin"]);
  await next();
};

const pricingSchema = z.object({
  version: z.number().int().positive(),
  activate: z.boolean().default(false),
  items: z
    .array(
      z.object({
        priceKey: z.string().trim().min(1).max(96),
        serviceKey: z.string().trim().min(1).max(64),
        provider: z.string().trim().min(1).max(64),
        unitName: z.string().trim().min(1).max(64),
        pricingType: z.enum(["measured", "allocated"]),
        unitCostMicrounits: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
        currency: z
          .string()
          .regex(/^[A-Za-z]{3}$/u)
          .default("UZS"),
      }),
    )
    .min(1)
    .max(100),
});

const grantSchema = z.object({
  accountId: z.uuid(),
  microcredits: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  expiresAt: z.iso.datetime().nullable().default(null),
  reason: z.string().trim().min(3).max(128),
});

const subscriptionSchema = z.object({
  accountId: z.uuid(),
  plan: z.enum(["pro", "trial"]),
  durationDays: z.number().int().min(1).max(365).default(30),
});

const promoSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{4,32}$/u),
  creditMicrocredits: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  validityDays: z.number().int().min(1).max(365).default(30),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  maxRedemptions: z.number().int().positive().max(1_000_000),
  budgetMicrocredits: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});

const compensationSchema = z.object({
  accountId: z.uuid(),
  originalOperationId: z.string().min(1).max(128),
  reason: z.enum([
    "system_error",
    "provider_no_result",
    "duplicate_charge",
    "wrong_price",
    "quality_review",
  ]),
  microcredits: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});

const budgetSchema = z.object({
  scopeKey: z.string().trim().min(1).max(64),
  periodType: z.enum(["daily", "monthly"]),
  limitMicrocredits: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  enabled: z.boolean().default(true),
});

const fxSchema = z.object({
  currency: z.string().regex(/^[A-Za-z]{3}$/u),
  rateDate: z.iso.date(),
  microUzsPerUnit: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  verifiedAt: z.iso.datetime(),
});

const referralActivitySchema = z.object({
  activityReference: z.string().trim().min(1).max(128),
});

export const adminFinancialRoutes = new Hono<AppBindings>();
adminFinancialRoutes.use("*", sessionAuthenticationMiddleware);
adminFinancialRoutes.use("*", csrfMiddleware);
adminFinancialRoutes.use("*", adminRoleMiddleware);
adminFinancialRoutes.use("*", adminTotpMiddleware);

const principalOf = (context: Parameters<typeof financialRepositoryFor>[0]) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  return principal;
};

adminFinancialRoutes.post("/pricing/versions", ownerOnly, async (context) => {
  const principal = principalOf(context);
  const input = validateInput(pricingSchema, await parseJsonBody(context.req.raw));
  const id = await financialRepositoryFor(context).createPricingVersion({
    ...input,
    actorAccountId: principal.accountId,
    now: new Date().toISOString(),
  });
  return context.json(successResponse({ id }, context.get("requestId")), 201);
});

adminFinancialRoutes.post("/grants", financeAdmin, async (context) => {
  const idempotencyKey = requireIdempotencyKey(context);
  const input = validateInput(grantSchema, await parseJsonBody(context.req.raw));
  const grant = await financialRepositoryFor(context).grantCredits({
    accountId: input.accountId,
    sourceType: "admin_bonus",
    sourceReference: `admin:${idempotencyKey}`,
    microcredits: input.microcredits,
    expiresAt: input.expiresAt,
    operationType: "admin_grant",
    idempotencyScope: "admin_grant",
    idempotencyKey,
    requestHash: await sha256Hex(JSON.stringify(input)),
    description: `Admin grant: ${input.reason}`,
    now: new Date().toISOString(),
  });
  return context.json(successResponse(grant, context.get("requestId")), 201);
});

adminFinancialRoutes.post("/subscriptions/grant", financeAdmin, async (context) => {
  const principal = principalOf(context);
  const idempotencyKey = requireIdempotencyKey(context);
  const input = validateInput(subscriptionSchema, await parseJsonBody(context.req.raw));
  const subscription = await financialRepositoryFor(context).grantSubscription({
    ...input,
    idempotencyKey,
    actorAccountId: principal.accountId,
    now: new Date(),
  });
  return context.json(successResponse(subscription, context.get("requestId")), 201);
});

adminFinancialRoutes.post("/promos", financeAdmin, async (context) => {
  const principal = principalOf(context);
  const input = validateInput(promoSchema, await parseJsonBody(context.req.raw));
  const id = await financialRepositoryFor(context).createPromo({
    ...input,
    actorAccountId: principal.accountId,
  });
  return context.json(successResponse({ id }, context.get("requestId")), 201);
});

adminFinancialRoutes.post("/compensations", financeAdmin, async (context) => {
  const principal = principalOf(context);
  const input = validateInput(compensationSchema, await parseJsonBody(context.req.raw));
  const result = await financialRepositoryFor(context).grantCompensation({
    ...input,
    actorAccountId: principal.accountId,
    requestHash: await sha256Hex(JSON.stringify(input)),
    now: new Date(),
  });
  return context.json(successResponse(result, context.get("requestId")), 201);
});

adminFinancialRoutes.put("/budgets", ownerOnly, async (context) => {
  const principal = principalOf(context);
  const input = validateInput(budgetSchema, await parseJsonBody(context.req.raw));
  await financialRepositoryFor(context).setBudget({
    ...input,
    actorAccountId: principal.accountId,
    now: new Date().toISOString(),
  });
  return context.json(successResponse({ updated: true }, context.get("requestId")));
});

adminFinancialRoutes.put("/fx-rates", ownerOnly, async (context) => {
  const principal = principalOf(context);
  const input = validateInput(fxSchema, await parseJsonBody(context.req.raw));
  await financialRepositoryFor(context).recordFxRate({
    ...input,
    actorAccountId: principal.accountId,
  });
  return context.json(successResponse({ updated: true }, context.get("requestId")));
});

adminFinancialRoutes.post("/referrals/:referralId/activity", financeAdmin, async (context) => {
  const input = validateInput(referralActivitySchema, await parseJsonBody(context.req.raw));
  await financialRepositoryFor(context).recordReferralActivity(
    context.req.param("referralId"),
    input.activityReference,
  );
  return context.json(successResponse({ recorded: true }, context.get("requestId")));
});

adminFinancialRoutes.post("/referrals/process", financeAdmin, async (context) => {
  const rewarded = await financialRepositoryFor(context).processReferralRewards(new Date());
  return context.json(successResponse({ rewarded }, context.get("requestId")));
});

adminFinancialRoutes.post("/reconciliation", financeAdmin, async (context) => {
  const principal = principalOf(context);
  const result = await financialRepositoryFor(context).reconcile(principal.accountId);
  return context.json(successResponse(result, context.get("requestId")), 201);
});

adminFinancialRoutes.get("/analytics", financeAdmin, async (context) =>
  context.json(
    successResponse(await financialRepositoryFor(context).analytics(), context.get("requestId")),
  ),
);
