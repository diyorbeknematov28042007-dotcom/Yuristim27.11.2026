import { env, SELF } from "cloudflare:test";
import { D1FinancialRepository, MICROCREDITS_PER_CREDIT, tashkentWeek } from "@yuristim/database";
import { beforeAll, describe, expect, it } from "vitest";
import { bearerHeaders, createBotSession, createOwnerSession } from "../helpers/auth";

const dataOf = async <T>(response: Response): Promise<T> => {
  const payload = await response.json<{ data: T }>();
  return payload.data;
};

let ownerHeaders: HeadersInit;

beforeAll(async () => {
  ownerHeaders = (await createOwnerSession(SELF)).headers;
  const pricing = await SELF.fetch("https://example.test/api/v1/admin/financial/pricing/versions", {
    method: "POST",
    headers: ownerHeaders,
    body: JSON.stringify({
      version: 501,
      activate: true,
      items: [
        {
          priceKey: "test.unit",
          serviceKey: "ai-lite",
          provider: "synthetic-provider",
          unitName: "operation",
          pricingType: "measured",
          unitCostMicrounits: MICROCREDITS_PER_CREDIT,
          currency: "UZS",
        },
      ],
    }),
  });
  if (pricing.status !== 201) throw new Error(`Pricing setup failed: ${await pricing.text()}`);
});

describe("Financial Core API", () => {
  it("grants one current weekly bucket and exposes server-authoritative balance", async () => {
    const { accessToken } = await createBotSession(SELF, "850000001");
    const headers = bearerHeaders(accessToken);
    const first = await SELF.fetch("https://example.test/api/v1/financial/balance", { headers });
    const second = await SELF.fetch("https://example.test/api/v1/financial/balance", { headers });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await dataOf<{ availableMicrocredits: number }>(second)).toMatchObject({
      availableMicrocredits: 2_000 * MICROCREDITS_PER_CREDIT,
    });
    const weeklyCount = await env.DB.prepare(
      "SELECT count(*) AS count FROM weekly_credit_grants WHERE account_id = (SELECT id FROM accounts WHERE telegram_user_id = ?1)",
    )
      .bind(850000001)
      .first<{ count: number }>();
    expect(weeklyCount?.count).toBe(1);
  });

  it("reserves, settles actual cost, returns unused credit and remains idempotent", async () => {
    const { accessToken } = await createBotSession(SELF, "850000002");
    const headers = { ...bearerHeaders(accessToken), "idempotency-key": "reserve-settle-001" };
    const reserveRequest = () =>
      SELF.fetch("https://example.test/api/v1/financial/reservations", {
        method: "POST",
        headers,
        body: JSON.stringify({
          priceKey: "test.unit",
          units: 100,
          maxMicrocredits: 400 * MICROCREDITS_PER_CREDIT,
        }),
      });
    const first = await reserveRequest();
    const retry = await reserveRequest();
    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    const firstData = await dataOf<{ reservation: { id: string } }>(first);
    const retryData = await dataOf<{ reservation: { id: string } }>(retry);
    expect(retryData.reservation.id).toBe(firstData.reservation.id);

    const settle = await SELF.fetch(
      `https://example.test/api/v1/financial/reservations/${firstData.reservation.id}/settle`,
      {
        method: "POST",
        headers: { ...bearerHeaders(accessToken), "idempotency-key": "settle-request-001" },
        body: JSON.stringify({ actualUnits: 60 }),
      },
    );
    expect(settle.status).toBe(200);
    expect(await dataOf<{ actualMicrocredits: number }>(settle)).toMatchObject({
      actualMicrocredits: 240 * MICROCREDITS_PER_CREDIT,
    });
    const balance = await SELF.fetch("https://example.test/api/v1/financial/balance", {
      headers: bearerHeaders(accessToken),
    });
    expect(
      await dataOf<{ availableMicrocredits: number; reservedMicrocredits: number }>(balance),
    ).toMatchObject({
      availableMicrocredits: 1_760 * MICROCREDITS_PER_CREDIT,
      reservedMicrocredits: 0,
    });
  });

  it("requires explicit consent for actual cost above the reservation", async () => {
    const { accessToken } = await createBotSession(SELF, "850000010");
    const reserve = await SELF.fetch("https://example.test/api/v1/financial/reservations", {
      method: "POST",
      headers: { ...bearerHeaders(accessToken), "idempotency-key": "overage-reserve-01" },
      body: JSON.stringify({
        priceKey: "test.unit",
        units: 100,
        maxMicrocredits: 400 * MICROCREDITS_PER_CREDIT,
      }),
    });
    const { reservation } = await dataOf<{ reservation: { id: string } }>(reserve);
    const settle = (consentToAdditionalCharge: boolean) =>
      SELF.fetch(`https://example.test/api/v1/financial/reservations/${reservation.id}/settle`, {
        method: "POST",
        headers: { ...bearerHeaders(accessToken), "idempotency-key": "overage-settle-01" },
        body: JSON.stringify({ actualUnits: 150, consentToAdditionalCharge }),
      });
    expect((await settle(false)).status).toBe(409);
    const approved = await settle(true);
    expect(approved.status).toBe(200);
    expect(await dataOf<{ actualMicrocredits: number }>(approved)).toMatchObject({
      actualMicrocredits: 600 * MICROCREDITS_PER_CREDIT,
    });
  });

  it("keeps valid reservations across weekly expiry and never restores expired unused credit", async () => {
    const user = await createBotSession(SELF, "850000011");
    const repository = new D1FinancialRepository(env.DB, {
      timeoutMs: 5_000,
      signal: new AbortController().signal,
    });
    const monday = new Date("2026-11-23T00:01:00+05:00");
    expect(tashkentWeek(monday)).toEqual({
      start: "2026-11-22T19:00:00.000Z",
      end: "2026-11-29T19:00:00.000Z",
    });
    await repository.ensureWeeklyGrant(user.accountId, monday);
    const estimate = await repository.estimateCost("test.unit", 100);
    const reservation = await repository.createReservation({
      accountId: user.accountId,
      idempotencyKey: "expiry-reservation-01",
      requestHash: "1".repeat(64),
      estimate,
      maxMicrocredits: estimate.chargeMicrocredits,
      expiresAt: "2026-12-01T01:01:00.000Z",
      now: "2026-11-22T19:01:00.000Z",
    });
    await repository.expireDueCredits("2026-11-29T19:00:01.000Z");
    const reserved = await repository.getBalance(user.accountId);
    expect(reserved).toMatchObject({
      availableMicrocredits: 0,
      reservedMicrocredits: 400 * MICROCREDITS_PER_CREDIT,
      expiredMicrocredits: 1_600 * MICROCREDITS_PER_CREDIT,
    });
    await repository.settleReservation({
      reservationId: reservation.id,
      accountId: user.accountId,
      actualUnits: 60,
      consentToAdditionalCharge: false,
      idempotencyKey: "expiry-settlement-01",
      requestHash: "2".repeat(64),
      now: "2026-11-29T19:00:02.000Z",
    });
    expect(await repository.getBalance(user.accountId)).toMatchObject({
      availableMicrocredits: 0,
      reservedMicrocredits: 0,
      consumedMicrocredits: 240 * MICROCREDITS_PER_CREDIT,
      expiredMicrocredits: 1_760 * MICROCREDITS_PER_CREDIT,
    });
  });

  it("releases abandoned reservations after their own deadline", async () => {
    const user = await createBotSession(SELF, "850000016");
    const repository = new D1FinancialRepository(env.DB, {
      timeoutMs: 5_000,
      signal: new AbortController().signal,
    });
    const now = new Date();
    await repository.ensureWeeklyGrant(user.accountId, now);
    const estimate = await repository.estimateCost("test.unit", 10);
    const reservation = await repository.createReservation({
      accountId: user.accountId,
      idempotencyKey: "abandoned-reservation-01",
      requestHash: "3".repeat(64),
      estimate,
      maxMicrocredits: estimate.chargeMicrocredits,
      expiresAt: new Date(now.getTime() + 60_000).toISOString(),
      now: now.toISOString(),
    });
    expect(await repository.releaseExpiredReservations(new Date(now.getTime() + 120_000))).toBe(1);
    expect(await repository.getReservation(user.accountId, reservation.id)).toMatchObject({
      status: "cancelled",
      actualMicrocredits: 0,
    });
    expect(await repository.getBalance(user.accountId)).toMatchObject({
      availableMicrocredits: 2_000 * MICROCREDITS_PER_CREDIT,
      reservedMicrocredits: 0,
    });
  });

  it("prevents parallel reservations from producing a negative balance", async () => {
    const { accessToken } = await createBotSession(SELF, "850000003");
    const make = (key: string) =>
      SELF.fetch("https://example.test/api/v1/financial/reservations", {
        method: "POST",
        headers: { ...bearerHeaders(accessToken), "idempotency-key": key },
        body: JSON.stringify({
          priceKey: "test.unit",
          units: 250,
          maxMicrocredits: 1_000 * MICROCREDITS_PER_CREDIT,
        }),
      });
    const responses = await Promise.all([
      make("parallel-reserve-01"),
      make("parallel-reserve-02"),
      make("parallel-reserve-03"),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 201, 402]);
    const account = await env.DB.prepare("SELECT id FROM accounts WHERE telegram_user_id = ?1")
      .bind(850000003)
      .first<{ id: string }>();
    const minimum = await env.DB.prepare(
      "SELECT min(available_microcredits) AS minimum FROM credit_buckets WHERE account_id = ?1",
    )
      .bind(account?.id)
      .first<{ minimum: number }>();
    expect(minimum?.minimum).toBeGreaterThanOrEqual(0);
  });

  it("spends weekly credit before bonus credit", async () => {
    const user = await createBotSession(SELF, "850000004");
    await SELF.fetch("https://example.test/api/v1/financial/balance", {
      headers: bearerHeaders(user.accessToken),
    });
    const grant = await SELF.fetch("https://example.test/api/v1/admin/financial/grants", {
      method: "POST",
      headers: { ...ownerHeaders, "idempotency-key": "spend-order-grant" },
      body: JSON.stringify({
        accountId: user.accountId,
        microcredits: 100 * MICROCREDITS_PER_CREDIT,
        reason: "Spending order test",
      }),
    });
    expect(grant.status).toBe(201);
    const reserve = await SELF.fetch("https://example.test/api/v1/financial/reservations", {
      method: "POST",
      headers: { ...bearerHeaders(user.accessToken), "idempotency-key": "spend-order-reserve" },
      body: JSON.stringify({
        priceKey: "test.unit",
        units: 510,
        maxMicrocredits: 2_040 * MICROCREDITS_PER_CREDIT,
      }),
    });
    expect(reserve.status).toBe(201);
    const { reservation } = await dataOf<{ reservation: { id: string } }>(reserve);
    const allocations = await env.DB.prepare(
      `SELECT b.source_type, a.reserved_microcredits
       FROM reservation_allocations a JOIN credit_buckets b ON b.id = a.bucket_id
       WHERE a.reservation_id = ?1 ORDER BY a.allocation_order`,
    )
      .bind(reservation.id)
      .all<{ source_type: string; reserved_microcredits: number }>();
    expect(allocations.results).toEqual([
      { source_type: "weekly", reserved_microcredits: 2_000 * MICROCREDITS_PER_CREDIT },
      { source_type: "admin_bonus", reserved_microcredits: 40 * MICROCREDITS_PER_CREDIT },
    ]);
  });

  it("keeps real payments disabled and does not create fake revenue", async () => {
    const { accessToken } = await createBotSession(SELF, "850000005");
    const response = await SELF.fetch("https://example.test/api/v1/financial/payments/intents", {
      method: "POST",
      headers: bearerHeaders(accessToken),
      body: JSON.stringify({ amountUzs: 49_000 }),
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      success: false,
      error: { code: "FEATURE_DISABLED" },
    });
    const count = await env.DB.prepare("SELECT count(*) AS count FROM payment_intents").first<{
      count: number;
    }>();
    expect(count?.count).toBe(0);
  });

  it("supports admin Pro grants, queues early renewal and never recognizes grant revenue", async () => {
    const user = await createBotSession(SELF, "850000006");
    const grant = (key: string) =>
      SELF.fetch("https://example.test/api/v1/admin/financial/subscriptions/grant", {
        method: "POST",
        headers: { ...ownerHeaders, "idempotency-key": key },
        body: JSON.stringify({ accountId: user.accountId, plan: "pro", durationDays: 30 }),
      });
    const first = await grant("subscription-grant-01");
    const second = await grant("subscription-grant-02");
    expect(first.status).toBe(201);
    expect(await dataOf<{ status: string }>(first)).toMatchObject({ status: "active" });
    expect(await dataOf<{ status: string }>(second)).toMatchObject({ status: "scheduled" });
    const subscription = await SELF.fetch("https://example.test/api/v1/financial/subscription", {
      headers: bearerHeaders(user.accessToken),
    });
    expect(await dataOf<{ plan: string; queued: unknown }>(subscription)).toMatchObject({
      plan: "pro",
    });
    const balance = await SELF.fetch("https://example.test/api/v1/financial/balance", {
      headers: bearerHeaders(user.accessToken),
    });
    expect(await dataOf<{ availableMicrocredits: number }>(balance)).toMatchObject({
      availableMicrocredits: 72_000 * MICROCREDITS_PER_CREDIT,
    });
  });

  it("issues linked compensation once without direct balance editing", async () => {
    const user = await createBotSession(SELF, "850000013");
    await SELF.fetch("https://example.test/api/v1/financial/balance", {
      headers: bearerHeaders(user.accessToken),
    });
    const original = await env.DB.prepare(
      "SELECT id FROM financial_operations WHERE account_id = ?1 AND idempotency_scope = 'weekly_credit'",
    )
      .bind(user.accountId)
      .first<{ id: string }>();
    expect(original?.id).toBeTypeOf("string");
    const compensate = () =>
      SELF.fetch("https://example.test/api/v1/admin/financial/compensations", {
        method: "POST",
        headers: ownerHeaders,
        body: JSON.stringify({
          accountId: user.accountId,
          originalOperationId: original?.id,
          reason: "system_error",
          microcredits: 100 * MICROCREDITS_PER_CREDIT,
        }),
      });
    expect((await compensate()).status).toBe(201);
    expect((await compensate()).status).toBe(201);
    const awards = await env.DB.prepare(
      "SELECT count(*) AS count FROM compensation_awards WHERE account_id = ?1",
    )
      .bind(user.accountId)
      .first<{ count: number }>();
    expect(awards?.count).toBe(1);
    const balance = await SELF.fetch("https://example.test/api/v1/financial/balance", {
      headers: bearerHeaders(user.accessToken),
    });
    expect(await dataOf<{ availableMicrocredits: number }>(balance)).toMatchObject({
      availableMicrocredits: 2_100 * MICROCREDITS_PER_CREDIT,
    });
  });

  it("enforces promo one-time redemption and budget limits", async () => {
    const now = new Date();
    const promo = await SELF.fetch("https://example.test/api/v1/admin/financial/promos", {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({
        code: "STAGE05",
        creditMicrocredits: 123 * MICROCREDITS_PER_CREDIT,
        startsAt: new Date(now.getTime() - 60_000).toISOString(),
        endsAt: new Date(now.getTime() + 86_400_000).toISOString(),
        maxRedemptions: 10,
        budgetMicrocredits: 1_230 * MICROCREDITS_PER_CREDIT,
      }),
    });
    expect(promo.status).toBe(201);
    const user = await createBotSession(SELF, "850000007");
    const redeem = () =>
      SELF.fetch("https://example.test/api/v1/financial/promos/redeem", {
        method: "POST",
        headers: bearerHeaders(user.accessToken),
        body: JSON.stringify({ code: "stage05" }),
      });
    expect((await redeem()).status).toBe(201);
    expect((await redeem()).status).toBe(409);

    const budget = await SELF.fetch("https://example.test/api/v1/admin/financial/budgets", {
      method: "PUT",
      headers: ownerHeaders,
      body: JSON.stringify({
        scopeKey: "ai-lite",
        periodType: "daily",
        limitMicrocredits: 100 * MICROCREDITS_PER_CREDIT,
      }),
    });
    expect(budget.status).toBe(200);
    const reserve = await SELF.fetch("https://example.test/api/v1/financial/reservations", {
      method: "POST",
      headers: { ...bearerHeaders(user.accessToken), "idempotency-key": "budget-stop-reserve" },
      body: JSON.stringify({
        priceKey: "test.unit",
        units: 50,
        maxMicrocredits: 200 * MICROCREDITS_PER_CREDIT,
      }),
    });
    expect(reserve.status).toBe(409);
    expect(await reserve.json()).toMatchObject({
      success: false,
      error: { code: "BUDGET_EXCEEDED" },
    });
  });

  it("requires three verified operations and 72 hours before referral rewards", async () => {
    const inviter = await createBotSession(SELF, "850000008");
    const invitee = await createBotSession(SELF, "850000009");
    const codeResponse = await SELF.fetch("https://example.test/api/v1/financial/referrals/code", {
      headers: bearerHeaders(inviter.accessToken),
    });
    const { code } = await dataOf<{ code: string }>(codeResponse);
    const applied = await SELF.fetch("https://example.test/api/v1/financial/referrals/apply", {
      method: "POST",
      headers: bearerHeaders(invitee.accessToken),
      body: JSON.stringify({ code }),
    });
    expect(applied.status).toBe(201);
    const { referralId } = await dataOf<{ referralId: string }>(applied);
    for (const reference of ["ai-op-1", "ai-op-2", "ai-op-3"]) {
      const activity = await SELF.fetch(
        `https://example.test/api/v1/admin/financial/referrals/${referralId}/activity`,
        {
          method: "POST",
          headers: ownerHeaders,
          body: JSON.stringify({ activityReference: reference }),
        },
      );
      expect(activity.status).toBe(200);
    }
    const premature = await SELF.fetch(
      "https://example.test/api/v1/admin/financial/referrals/process",
      { method: "POST", headers: ownerHeaders },
    );
    expect(await dataOf<{ rewarded: number }>(premature)).toEqual({ rewarded: 0 });
    await env.DB.prepare("UPDATE referrals SET eligible_at = ?1 WHERE id = ?2")
      .bind(new Date(Date.now() - 1_000).toISOString(), referralId)
      .run();
    const mature = await SELF.fetch(
      "https://example.test/api/v1/admin/financial/referrals/process",
      { method: "POST", headers: ownerHeaders },
    );
    expect(await dataOf<{ rewarded: number }>(mature)).toEqual({ rewarded: 1 });
  });

  it("atomically enforces promo redemption capacity under parallel requests", async () => {
    const now = new Date();
    const promo = await SELF.fetch("https://example.test/api/v1/admin/financial/promos", {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({
        code: "ONEONLY",
        creditMicrocredits: 50 * MICROCREDITS_PER_CREDIT,
        startsAt: new Date(now.getTime() - 60_000).toISOString(),
        endsAt: new Date(now.getTime() + 86_400_000).toISOString(),
        maxRedemptions: 1,
        budgetMicrocredits: 50 * MICROCREDITS_PER_CREDIT,
      }),
    });
    expect(promo.status).toBe(201);
    const first = await createBotSession(SELF, "850000014");
    const second = await createBotSession(SELF, "850000015");
    const redeem = (accessToken: string) =>
      SELF.fetch("https://example.test/api/v1/financial/promos/redeem", {
        method: "POST",
        headers: bearerHeaders(accessToken),
        body: JSON.stringify({ code: "ONEONLY" }),
      });
    const responses = await Promise.all([redeem(first.accessToken), redeem(second.accessToken)]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const count = await env.DB.prepare(
      "SELECT count(*) AS count FROM promo_redemptions WHERE promo_id = ?1",
    )
      .bind((await dataOf<{ id: string }>(promo)).id)
      .first<{ count: number }>();
    expect(count?.count).toBe(1);
  });

  it("runs reconciliation with no bucket mismatch", async () => {
    const response = await SELF.fetch(
      "https://example.test/api/v1/admin/financial/reconciliation",
      { method: "POST", headers: ownerHeaders },
    );
    expect(response.status).toBe(201);
    expect(await dataOf<{ status: string; mismatches: number }>(response)).toMatchObject({
      status: "passed",
      mismatches: 0,
    });
  });

  it("converts foreign provider cost through the last verified CBU rate", async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
    const rate = await SELF.fetch("https://example.test/api/v1/admin/financial/fx-rates", {
      method: "PUT",
      headers: ownerHeaders,
      body: JSON.stringify({
        currency: "USD",
        rateDate: yesterday,
        microUzsPerUnit: 12_000 * MICROCREDITS_PER_CREDIT,
        verifiedAt: now.toISOString(),
      }),
    });
    expect(rate.status).toBe(200);
    const pricing = await SELF.fetch(
      "https://example.test/api/v1/admin/financial/pricing/versions",
      {
        method: "POST",
        headers: ownerHeaders,
        body: JSON.stringify({
          version: 502,
          activate: true,
          items: [
            {
              priceKey: "foreign.usd-unit",
              serviceKey: "foreign-service",
              provider: "synthetic-foreign-provider",
              unitName: "request",
              pricingType: "measured",
              unitCostMicrounits: MICROCREDITS_PER_CREDIT,
              currency: "USD",
            },
          ],
        }),
      },
    );
    expect(pricing.status).toBe(201);
    const user = await createBotSession(SELF, "850000012");
    const estimate = await SELF.fetch("https://example.test/api/v1/financial/costs/estimate", {
      method: "POST",
      headers: bearerHeaders(user.accessToken),
      body: JSON.stringify({ priceKey: "foreign.usd-unit", units: 2 }),
    });
    expect(estimate.status).toBe(200);
    expect(
      await dataOf<{
        directCostMicroUzs: number;
        chargeMicrocredits: number;
        sourceCurrency: string;
        fxFallbackUsed: boolean;
      }>(estimate),
    ).toMatchObject({
      directCostMicroUzs: 24_000 * MICROCREDITS_PER_CREDIT,
      chargeMicrocredits: 96_000 * MICROCREDITS_PER_CREDIT,
      sourceCurrency: "USD",
      fxFallbackUsed: true,
    });
  });
});
