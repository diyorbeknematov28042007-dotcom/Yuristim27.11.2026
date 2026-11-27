import { successResponse } from "@yuristim/contracts";
import { D1FeatureFlagRepository } from "@yuristim/database";
import { AppError } from "@yuristim/errors";
import { enforceFeatureFlag, sha256Hex } from "@yuristim/security";
import { parseJsonBody, validateInput } from "@yuristim/validation";
import { Hono } from "hono";
import { z } from "zod";
import {
  activeAccountMiddleware,
  csrfMiddleware,
  sessionAuthenticationMiddleware,
} from "../middleware/authentication";
import { financialRepositoryFor, requireIdempotencyKey } from "../services/financial";
import type { AppBindings } from "../types";

const estimateSchema = z.object({
  priceKey: z.string().trim().min(1).max(96),
  units: z.number().int().positive().max(1_000_000_000),
});

const reserveSchema = estimateSchema.extend({
  maxMicrocredits: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  reservationTtlSeconds: z.number().int().min(60).max(86_400).default(3_600),
});

const settleSchema = z.object({
  actualUnits: z.number().int().nonnegative().max(1_000_000_000),
  consentToAdditionalCharge: z.boolean().default(false),
});

const promoSchema = z.object({ code: z.string().trim().min(4).max(32) });
const referralSchema = z.object({ code: z.string().trim().min(6).max(16) });

export const financialRoutes = new Hono<AppBindings>();
financialRoutes.use("*", sessionAuthenticationMiddleware);
financialRoutes.use("*", csrfMiddleware);

const principalOf = (context: Parameters<typeof financialRepositoryFor>[0]) => {
  const principal = context.get("principal");
  if (principal === undefined) throw new AppError("UNAUTHORIZED", "Authentication required");
  return principal;
};

const flagEnabled = async (
  context: Parameters<typeof financialRepositoryFor>[0],
  key: "financial_reservations" | "promo_redemption" | "referral_rewards" | "weekly_credit_grants",
): Promise<void> => {
  const config = context.get("config");
  if (config === undefined) throw new AppError("SERVICE_UNAVAILABLE", "Configuration unavailable");
  const repository = new D1FeatureFlagRepository(context.env.DB, {
    timeoutMs: config.REQUEST_TIMEOUT_MS,
    signal: context.req.raw.signal,
  });
  enforceFeatureFlag(await repository.isEnabled(key));
};

financialRoutes.get("/balance", async (context) => {
  const principal = principalOf(context);
  await flagEnabled(context, "weekly_credit_grants");
  const repository = financialRepositoryFor(context);
  await repository.expireDueCredits(new Date().toISOString());
  await repository.ensureWeeklyGrant(principal.accountId, new Date());
  return context.json(
    successResponse(await repository.getBalance(principal.accountId), context.get("requestId")),
  );
});

financialRoutes.get("/ledger", async (context) => {
  const principal = principalOf(context);
  const limit = Number(context.req.query("limit") ?? "100");
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new AppError("VALIDATION_ERROR", "Invalid ledger limit");
  }
  return context.json(
    successResponse(
      { entries: await financialRepositoryFor(context).listLedger(principal.accountId, limit) },
      context.get("requestId"),
    ),
  );
});

financialRoutes.get("/subscription", async (context) => {
  const principal = principalOf(context);
  return context.json(
    successResponse(
      await financialRepositoryFor(context).getSubscription(
        principal.accountId,
        new Date().toISOString(),
      ),
      context.get("requestId"),
    ),
  );
});

financialRoutes.post("/costs/estimate", activeAccountMiddleware, async (context) => {
  const input = validateInput(estimateSchema, await parseJsonBody(context.req.raw));
  return context.json(
    successResponse(
      await financialRepositoryFor(context).estimateCost(input.priceKey, input.units),
      context.get("requestId"),
    ),
  );
});

financialRoutes.post("/reservations", activeAccountMiddleware, async (context) => {
  await flagEnabled(context, "financial_reservations");
  const principal = principalOf(context);
  const idempotencyKey = requireIdempotencyKey(context);
  const input = validateInput(reserveSchema, await parseJsonBody(context.req.raw));
  const repository = financialRepositoryFor(context);
  await repository.expireDueCredits(new Date().toISOString());
  await repository.ensureWeeklyGrant(principal.accountId, new Date());
  const estimate = await repository.estimateCost(input.priceKey, input.units);
  const requestHash = await sha256Hex(
    JSON.stringify({
      accountId: principal.accountId,
      priceKey: input.priceKey,
      units: input.units,
      maxMicrocredits: input.maxMicrocredits,
      reservationTtlSeconds: input.reservationTtlSeconds,
    }),
  );
  const now = new Date();
  const reservation = await repository.createReservation({
    accountId: principal.accountId,
    idempotencyKey,
    requestHash,
    estimate,
    maxMicrocredits: input.maxMicrocredits,
    expiresAt: new Date(now.getTime() + input.reservationTtlSeconds * 1_000).toISOString(),
    now: now.toISOString(),
  });
  return context.json(successResponse({ reservation, estimate }, context.get("requestId")), 201);
});

financialRoutes.get("/reservations/:reservationId", async (context) => {
  const principal = principalOf(context);
  return context.json(
    successResponse(
      await financialRepositoryFor(context).getReservation(
        principal.accountId,
        context.req.param("reservationId"),
      ),
      context.get("requestId"),
    ),
  );
});

financialRoutes.post(
  "/reservations/:reservationId/settle",
  activeAccountMiddleware,
  async (context) => {
    await flagEnabled(context, "financial_reservations");
    const principal = principalOf(context);
    const idempotencyKey = requireIdempotencyKey(context);
    const input = validateInput(settleSchema, await parseJsonBody(context.req.raw));
    const reservationId = context.req.param("reservationId");
    const requestHash = await sha256Hex(
      JSON.stringify({ reservationId, accountId: principal.accountId, ...input }),
    );
    const result = await financialRepositoryFor(context).settleReservation({
      reservationId,
      accountId: principal.accountId,
      actualUnits: input.actualUnits,
      consentToAdditionalCharge: input.consentToAdditionalCharge,
      idempotencyKey,
      requestHash,
      now: new Date().toISOString(),
    });
    return context.json(successResponse(result, context.get("requestId")));
  },
);

financialRoutes.post(
  "/reservations/:reservationId/cancel",
  activeAccountMiddleware,
  async (context) => {
    const principal = principalOf(context);
    const idempotencyKey = requireIdempotencyKey(context);
    const reservationId = context.req.param("reservationId");
    const requestHash = await sha256Hex(
      JSON.stringify({ reservationId, accountId: principal.accountId, action: "cancel" }),
    );
    const result = await financialRepositoryFor(context).cancelReservation({
      reservationId,
      accountId: principal.accountId,
      idempotencyKey,
      requestHash,
      now: new Date().toISOString(),
    });
    return context.json(successResponse(result, context.get("requestId")));
  },
);

financialRoutes.post("/promos/redeem", activeAccountMiddleware, async (context) => {
  await flagEnabled(context, "promo_redemption");
  const principal = principalOf(context);
  const input = validateInput(promoSchema, await parseJsonBody(context.req.raw));
  const result = await financialRepositoryFor(context).redeemPromo({
    accountId: principal.accountId,
    code: input.code,
    requestHash: await sha256Hex(
      JSON.stringify({ accountId: principal.accountId, code: input.code.toUpperCase() }),
    ),
    now: new Date(),
  });
  return context.json(successResponse(result, context.get("requestId")), 201);
});

financialRoutes.get("/referrals/code", async (context) => {
  const principal = principalOf(context);
  return context.json(
    successResponse(
      { code: await financialRepositoryFor(context).getOrCreateReferralCode(principal.accountId) },
      context.get("requestId"),
    ),
  );
});

financialRoutes.post("/referrals/apply", activeAccountMiddleware, async (context) => {
  await flagEnabled(context, "referral_rewards");
  const principal = principalOf(context);
  const input = validateInput(referralSchema, await parseJsonBody(context.req.raw));
  const referralId = await financialRepositoryFor(context).applyReferral({
    inviteeAccountId: principal.accountId,
    code: input.code,
    now: new Date(),
  });
  return context.json(
    successResponse({ referralId, status: "pending_review" }, context.get("requestId")),
    201,
  );
});

financialRoutes.post("/payments/intents", activeAccountMiddleware, () => {
  throw new AppError("FEATURE_DISABLED", "Real payments and credit purchases are disabled");
});
