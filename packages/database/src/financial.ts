import { AppError } from "@yuristim/errors";
import { runD1Operation, type D1ExecutionPolicy } from "./execution";

export const MICROCREDITS_PER_CREDIT = 1_000_000;
export const WEEKLY_CREDIT_MICROCREDITS = 2_000 * MICROCREDITS_PER_CREDIT;
export const PRO_CREDIT_MICROCREDITS = 70_000 * MICROCREDITS_PER_CREDIT;
export const PRO_PRICE_UZS = 49_000;
export const DIRECT_COST_MULTIPLIER = 4;

export type CreditSource =
  "weekly" | "compensation" | "promo" | "referral" | "subscription" | "purchased" | "admin_bonus";

type OperationType =
  | "grant"
  | "reserve"
  | "settle"
  | "release"
  | "expire"
  | "compensation"
  | "promo"
  | "referral"
  | "subscription"
  | "admin_grant";

export type BalanceSnapshot = {
  availableMicrocredits: number;
  reservedMicrocredits: number;
  consumedMicrocredits: number;
  expiredMicrocredits: number;
  availableCredits: number;
  buckets: Array<{
    id: string;
    sourceType: CreditSource;
    availableMicrocredits: number;
    reservedMicrocredits: number;
    expiresAt: string | null;
  }>;
};

type PriceRow = {
  version_id: string;
  version: number;
  pricing_item_id: string;
  price_key: string;
  service_key: string;
  provider: string;
  unit_name: string;
  pricing_type: "measured" | "allocated";
  unit_cost_microunits: number;
  currency: string;
  markup_multiplier: number;
};

export type CostEstimate = {
  priceVersionId: string;
  priceVersion: number;
  pricingItemId: string;
  priceKey: string;
  serviceKey: string;
  provider: string;
  unitName: string;
  pricingType: "measured" | "allocated";
  units: number;
  directCostMicroUzs: number;
  chargeMicrocredits: number;
  multiplier: 4;
  sourceCurrency: string;
  fxRateDate: string | null;
  fxFallbackUsed: boolean;
};

const assertSafePositive = (value: number, name: string): void => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new AppError("VALIDATION_ERROR", `${name} must be a positive safe integer`);
  }
};

const assertSafeNonNegative = (value: number, name: string): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new AppError("VALIDATION_ERROR", `${name} must be a non-negative safe integer`);
  }
};

const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1_000);

export const tashkentWeek = (date: Date): { start: string; end: string } => {
  const local = new Date(date.getTime() + 5 * 60 * 60 * 1_000);
  const day = local.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  local.setUTCDate(local.getUTCDate() - daysSinceMonday);
  local.setUTCHours(0, 0, 0, 0);
  const start = new Date(local.getTime() - 5 * 60 * 60 * 1_000);
  return { start: start.toISOString(), end: addDays(start, 7).toISOString() };
};

const periodStart = (now: Date, period: "daily" | "monthly"): string => {
  const value = new Date(now);
  value.setUTCHours(0, 0, 0, 0);
  if (period === "monthly") value.setUTCDate(1);
  return value.toISOString();
};

const spendingPriority = `CASE b.source_type
  WHEN 'weekly' THEN 1
  WHEN 'compensation' THEN 2
  WHEN 'promo' THEN 3
  WHEN 'referral' THEN 3
  WHEN 'admin_bonus' THEN 3
  WHEN 'subscription' THEN 4
  WHEN 'purchased' THEN 5
  ELSE 99 END`;

export class D1FinancialRepository {
  constructor(
    private readonly database: D1Database,
    private readonly policy: D1ExecutionPolicy,
  ) {}

  private async existingOperation(
    accountId: string,
    scope: string,
    idempotencyKey: string,
  ): Promise<{ id: string; request_hash: string } | null> {
    return runD1Operation(
      () =>
        this.database
          .prepare(
            "SELECT id, request_hash FROM financial_operations WHERE account_id = ?1 AND idempotency_scope = ?2 AND idempotency_key = ?3",
          )
          .bind(accountId, scope, idempotencyKey)
          .first<{ id: string; request_hash: string }>(),
      this.policy,
    );
  }

  private assertIdempotency(existing: { request_hash: string } | null, requestHash: string): void {
    if (existing !== null && existing.request_hash !== requestHash) {
      throw new AppError("CONFLICT", "Idempotency key was already used with another request");
    }
  }

  async grantCredits(input: {
    accountId: string;
    sourceType: CreditSource;
    sourceReference: string;
    microcredits: number;
    expiresAt: string | null;
    operationType: OperationType;
    idempotencyScope: string;
    idempotencyKey: string;
    requestHash: string;
    description: string;
    now: string;
  }): Promise<{ operationId: string; bucketId: string; created: boolean }> {
    assertSafePositive(input.microcredits, "microcredits");
    const existing = await this.existingOperation(
      input.accountId,
      input.idempotencyScope,
      input.idempotencyKey,
    );
    this.assertIdempotency(existing, input.requestHash);
    if (existing !== null) {
      const bucket = await runD1Operation(
        () =>
          this.database
            .prepare(
              "SELECT id FROM credit_buckets WHERE account_id = ?1 AND source_type = ?2 AND source_reference = ?3",
            )
            .bind(input.accountId, input.sourceType, input.sourceReference)
            .first<{ id: string }>(),
        this.policy,
      );
      if (bucket === null)
        throw new AppError("SERVICE_UNAVAILABLE", "Idempotent grant is incomplete");
      return { operationId: existing.id, bucketId: bucket.id, created: false };
    }

    const operationId = crypto.randomUUID();
    const bucketId = crypto.randomUUID();
    try {
      await runD1Operation(
        () =>
          this.database.batch([
            this.database
              .prepare("INSERT OR IGNORE INTO financial_wallets (account_id) VALUES (?1)")
              .bind(input.accountId),
            this.database
              .prepare(
                `INSERT INTO financial_operations (
                  id, account_id, operation_type, idempotency_scope, idempotency_key,
                  request_hash, related_entity_type, related_entity_id, created_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'credit_bucket', ?7, ?8)`,
              )
              .bind(
                operationId,
                input.accountId,
                input.operationType,
                input.idempotencyScope,
                input.idempotencyKey,
                input.requestHash,
                bucketId,
                input.now,
              ),
            this.database
              .prepare(
                `INSERT INTO credit_buckets (
                  id, account_id, source_type, source_reference, initial_microcredits,
                  available_microcredits, expires_at, created_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?6, ?7)`,
              )
              .bind(
                bucketId,
                input.accountId,
                input.sourceType,
                input.sourceReference,
                input.microcredits,
                input.expiresAt,
                input.now,
              ),
            this.database
              .prepare(
                `INSERT INTO financial_ledger_entries (
                  id, operation_id, account_id, bucket_id, entry_type,
                  available_delta, description, created_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
              )
              .bind(
                crypto.randomUUID(),
                operationId,
                input.accountId,
                bucketId,
                input.operationType === "compensation" ? "compensation" : "grant",
                input.microcredits,
                input.description,
                input.now,
              ),
          ]),
        this.policy,
      );
      return { operationId, bucketId, created: true };
    } catch (cause) {
      const raced = await this.existingOperation(
        input.accountId,
        input.idempotencyScope,
        input.idempotencyKey,
      );
      this.assertIdempotency(raced, input.requestHash);
      if (raced === null) throw cause;
      const bucket = await runD1Operation(
        () =>
          this.database
            .prepare(
              "SELECT id FROM credit_buckets WHERE account_id = ?1 AND source_type = ?2 AND source_reference = ?3",
            )
            .bind(input.accountId, input.sourceType, input.sourceReference)
            .first<{ id: string }>(),
        this.policy,
      );
      if (bucket === null) throw cause;
      return { operationId: raced.id, bucketId: bucket.id, created: false };
    }
  }

  async ensureWeeklyGrant(accountId: string, now: Date): Promise<void> {
    const week = tashkentWeek(now);
    const result = await this.grantCredits({
      accountId,
      sourceType: "weekly",
      sourceReference: week.start,
      microcredits: WEEKLY_CREDIT_MICROCREDITS,
      expiresAt: week.end,
      operationType: "grant",
      idempotencyScope: "weekly_credit",
      idempotencyKey: week.start,
      requestHash: "0".repeat(64),
      description: "Weekly free credits",
      now: now.toISOString(),
    });
    await runD1Operation(
      () =>
        this.database
          .prepare(
            `INSERT OR IGNORE INTO weekly_credit_grants (
              id, account_id, week_start, operation_id, bucket_id, granted_microcredits, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
          )
          .bind(
            crypto.randomUUID(),
            accountId,
            week.start,
            result.operationId,
            result.bucketId,
            WEEKLY_CREDIT_MICROCREDITS,
            now.toISOString(),
          )
          .run(),
      this.policy,
    );
  }

  async grantWeeklyToActiveAccounts(now: Date): Promise<number> {
    let cursor = "";
    let processed = 0;
    for (;;) {
      const page = await runD1Operation(
        () =>
          this.database
            .prepare(
              "SELECT id FROM accounts WHERE status = 'active' AND id > ?1 ORDER BY id LIMIT 100",
            )
            .bind(cursor)
            .all<{ id: string }>(),
        this.policy,
      );
      if (page.results.length === 0) break;
      for (const row of page.results) {
        await this.ensureWeeklyGrant(row.id, now);
        cursor = row.id;
        processed += 1;
      }
    }
    return processed;
  }

  async expireDueCredits(now: string): Promise<number> {
    const zeroHash = "0".repeat(64);
    const due = await runD1Operation(
      () =>
        this.database
          .prepare(
            "SELECT count(*) AS count FROM credit_buckets WHERE expires_at IS NOT NULL AND expires_at <= ?1 AND available_microcredits > 0",
          )
          .bind(now)
          .first<{ count: number }>(),
      this.policy,
    );
    if ((due?.count ?? 0) === 0) return 0;
    await runD1Operation(
      () =>
        this.database.batch([
          this.database
            .prepare(
              `INSERT OR IGNORE INTO financial_operations (
                id, account_id, operation_type, idempotency_scope, idempotency_key,
                request_hash, related_entity_type, related_entity_id, created_at
              )
              SELECT 'expire:' || id, account_id, 'expire', 'bucket_expiry', id,
                ?1, 'credit_bucket', id, ?2
              FROM credit_buckets
              WHERE expires_at IS NOT NULL AND expires_at <= ?2 AND available_microcredits > 0`,
            )
            .bind(zeroHash, now),
          this.database
            .prepare(
              `INSERT OR IGNORE INTO financial_ledger_entries (
                id, operation_id, account_id, bucket_id, entry_type,
                available_delta, expired_delta, description, created_at
              )
              SELECT lower(hex(randomblob(16))), 'expire:' || id, account_id, id, 'expire',
                -available_microcredits, available_microcredits, 'Unused expiring credits expired', ?1
              FROM credit_buckets
              WHERE expires_at IS NOT NULL AND expires_at <= ?1 AND available_microcredits > 0`,
            )
            .bind(now),
          this.database
            .prepare(
              `UPDATE credit_buckets SET
                expired_microcredits = expired_microcredits + available_microcredits,
                available_microcredits = 0,
                status = 'expired'
              WHERE expires_at IS NOT NULL AND expires_at <= ?1 AND available_microcredits > 0`,
            )
            .bind(now),
        ]),
      this.policy,
    );
    return due?.count ?? 0;
  }

  async getBalance(accountId: string): Promise<BalanceSnapshot> {
    const result = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT id, source_type, available_microcredits, reserved_microcredits,
              consumed_microcredits, expired_microcredits, expires_at
            FROM credit_buckets b
            WHERE b.account_id = ?1
            ORDER BY ${spendingPriority}, COALESCE(expires_at, '9999-12-31'), created_at`,
          )
          .bind(accountId)
          .all<{
            id: string;
            source_type: CreditSource;
            available_microcredits: number;
            reserved_microcredits: number;
            consumed_microcredits: number;
            expired_microcredits: number;
            expires_at: string | null;
          }>(),
      this.policy,
    );
    const totals = result.results.reduce(
      (sum, row) => ({
        available: sum.available + row.available_microcredits,
        reserved: sum.reserved + row.reserved_microcredits,
        consumed: sum.consumed + row.consumed_microcredits,
        expired: sum.expired + row.expired_microcredits,
      }),
      { available: 0, reserved: 0, consumed: 0, expired: 0 },
    );
    return {
      availableMicrocredits: totals.available,
      reservedMicrocredits: totals.reserved,
      consumedMicrocredits: totals.consumed,
      expiredMicrocredits: totals.expired,
      availableCredits: totals.available / MICROCREDITS_PER_CREDIT,
      buckets: result.results
        .filter((row) => row.available_microcredits > 0 || row.reserved_microcredits > 0)
        .map((row) => ({
          id: row.id,
          sourceType: row.source_type,
          availableMicrocredits: row.available_microcredits,
          reservedMicrocredits: row.reserved_microcredits,
          expiresAt: row.expires_at,
        })),
    };
  }

  async listLedger(accountId: string, limit = 100): Promise<unknown[]> {
    const result = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT l.id, l.operation_id AS operationId, l.bucket_id AS bucketId,
              b.source_type AS sourceType, l.entry_type AS entryType,
              l.available_delta AS availableDelta, l.reserved_delta AS reservedDelta,
              l.consumed_delta AS consumedDelta, l.expired_delta AS expiredDelta,
              l.description, l.created_at AS createdAt
            FROM financial_ledger_entries l
            JOIN credit_buckets b ON b.id = l.bucket_id
            WHERE l.account_id = ?1
            ORDER BY l.created_at DESC, l.id DESC LIMIT ?2`,
          )
          .bind(accountId, Math.min(Math.max(limit, 1), 200))
          .all(),
      this.policy,
    );
    return result.results;
  }

  async createPricingVersion(input: {
    version: number;
    items: Array<{
      priceKey: string;
      serviceKey: string;
      provider: string;
      unitName: string;
      pricingType: "measured" | "allocated";
      unitCostMicrounits: number;
      currency: string;
    }>;
    actorAccountId: string;
    activate: boolean;
    now: string;
  }): Promise<string> {
    assertSafePositive(input.version, "version");
    if (input.items.length === 0 || input.items.length > 100) {
      throw new AppError("VALIDATION_ERROR", "Pricing version requires 1 to 100 items");
    }
    for (const item of input.items)
      assertSafeNonNegative(item.unitCostMicrounits, "unitCostMicrounits");
    const id = crypto.randomUUID();
    const statements: D1PreparedStatement[] = [];
    if (input.activate) {
      statements.push(
        this.database.prepare(
          "UPDATE pricing_versions SET status = 'retired' WHERE status = 'active'",
        ),
      );
    }
    statements.push(
      this.database
        .prepare(
          `INSERT INTO pricing_versions (
            id, version, status, effective_at, created_by_account_id, created_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?4)`,
        )
        .bind(
          id,
          input.version,
          input.activate ? "active" : "draft",
          input.now,
          input.actorAccountId,
        ),
    );
    for (const item of input.items) {
      statements.push(
        this.database
          .prepare(
            `INSERT INTO pricing_items (
              id, version_id, price_key, service_key, provider, unit_name,
              pricing_type, unit_cost_microunits, currency, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
          )
          .bind(
            crypto.randomUUID(),
            id,
            item.priceKey,
            item.serviceKey,
            item.provider,
            item.unitName,
            item.pricingType,
            item.unitCostMicrounits,
            item.currency.toUpperCase(),
            input.now,
          ),
      );
    }
    await runD1Operation(() => this.database.batch(statements), this.policy);
    return id;
  }

  async estimateCost(priceKey: string, units: number): Promise<CostEstimate> {
    assertSafePositive(units, "units");
    const row = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT v.id AS version_id, v.version, i.id AS pricing_item_id, i.price_key,
              i.service_key, i.provider, i.unit_name, i.pricing_type,
              i.unit_cost_microunits, i.currency, v.markup_multiplier
            FROM pricing_versions v JOIN pricing_items i ON i.version_id = v.id
            WHERE v.status = 'active' AND i.price_key = ?1`,
          )
          .bind(priceKey)
          .first<PriceRow>(),
      this.policy,
    );
    if (row === null) throw new AppError("SERVICE_UNAVAILABLE", "Cost is unknown or restricted");
    let unitCostMicroUzs = row.unit_cost_microunits;
    let fxRateDate: string | null = null;
    let fxFallbackUsed = false;
    if (row.currency !== "UZS") {
      const today = new Date().toISOString().slice(0, 10);
      const rate = await runD1Operation(
        () =>
          this.database
            .prepare(
              `SELECT rate_date, micro_uzs_per_unit FROM fx_rates
               WHERE currency = ?1 AND rate_date <= ?2
               ORDER BY rate_date DESC LIMIT 1`,
            )
            .bind(row.currency, today)
            .first<{ rate_date: string; micro_uzs_per_unit: number }>(),
        this.policy,
      );
      if (rate === null) {
        throw new AppError(
          "SERVICE_UNAVAILABLE",
          "Verified currency conversion rate is unavailable",
        );
      }
      const numerator = BigInt(row.unit_cost_microunits) * BigInt(rate.micro_uzs_per_unit);
      const converted =
        (numerator + BigInt(MICROCREDITS_PER_CREDIT - 1)) / BigInt(MICROCREDITS_PER_CREDIT);
      if (converted > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new AppError("VALIDATION_ERROR", "Converted cost exceeds safe integer range");
      }
      unitCostMicroUzs = Number(converted);
      fxRateDate = rate.rate_date;
      fxFallbackUsed = rate.rate_date !== today;
    }
    const directCost = unitCostMicroUzs * units;
    const charge = directCost * row.markup_multiplier;
    if (!Number.isSafeInteger(directCost) || !Number.isSafeInteger(charge)) {
      throw new AppError("VALIDATION_ERROR", "Cost exceeds safe integer range");
    }
    return {
      priceVersionId: row.version_id,
      priceVersion: row.version,
      pricingItemId: row.pricing_item_id,
      priceKey: row.price_key,
      serviceKey: row.service_key,
      provider: row.provider,
      unitName: row.unit_name,
      pricingType: row.pricing_type,
      units,
      directCostMicroUzs: directCost,
      chargeMicrocredits: charge,
      multiplier: DIRECT_COST_MULTIPLIER,
      sourceCurrency: row.currency,
      fxRateDate,
      fxFallbackUsed,
    };
  }

  private async budgetFor(serviceKey: string): Promise<{
    scope_key: string;
    period_type: "daily" | "monthly";
    limit_microcredits: number;
  } | null> {
    return runD1Operation(
      () =>
        this.database
          .prepare(
            "SELECT scope_key, period_type, limit_microcredits FROM budget_policies WHERE scope_key = ?1 AND enabled = 1",
          )
          .bind(serviceKey)
          .first<{
            scope_key: string;
            period_type: "daily" | "monthly";
            limit_microcredits: number;
          }>(),
      this.policy,
    );
  }

  private async recordBudgetAlerts(input: {
    scopeKey: string;
    periodStart: string;
    limitMicrocredits: number;
  }): Promise<void> {
    const usage = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT COALESCE(sum(
              CASE WHEN status = 'active' THEN reserved_microcredits
                   ELSE COALESCE(actual_microcredits, 0) END
            ), 0) AS used
            FROM credit_reservations
            WHERE service_key = ?1 AND created_at >= ?2`,
          )
          .bind(input.scopeKey, input.periodStart)
          .first<{ used: number }>(),
      this.policy,
    );
    const used = usage?.used ?? 0;
    const reached = [50, 75, 90, 100].filter(
      (threshold) => used * 100 >= input.limitMicrocredits * threshold,
    );
    if (reached.length === 0) return;
    await runD1Operation(
      () =>
        this.database.batch(
          reached.map((threshold) =>
            this.database
              .prepare(
                `INSERT OR IGNORE INTO budget_alerts (
                  id, scope_key, period_start, threshold_percent, observed_microcredits
                ) VALUES (?1, ?2, ?3, ?4, ?5)`,
              )
              .bind(crypto.randomUUID(), input.scopeKey, input.periodStart, threshold, used),
          ),
        ),
      this.policy,
    );
  }

  async createReservation(input: {
    accountId: string;
    idempotencyKey: string;
    requestHash: string;
    estimate: CostEstimate;
    maxMicrocredits: number;
    expiresAt: string;
    now: string;
  }): Promise<{ id: string; status: string; estimatedMicrocredits: number }> {
    assertSafePositive(input.maxMicrocredits, "maxMicrocredits");
    if (new Date(input.expiresAt).getTime() <= new Date(input.now).getTime()) {
      throw new AppError("VALIDATION_ERROR", "Reservation expiry must be in the future");
    }
    if (input.estimate.chargeMicrocredits > input.maxMicrocredits) {
      throw new AppError("CONFLICT", "Estimated cost exceeds approved maximum");
    }
    const existing = await runD1Operation(
      () =>
        this.database
          .prepare(
            "SELECT id, request_hash, status, estimated_microcredits FROM credit_reservations WHERE account_id = ?1 AND idempotency_key = ?2",
          )
          .bind(input.accountId, input.idempotencyKey)
          .first<{
            id: string;
            request_hash: string;
            status: string;
            estimated_microcredits: number;
          }>(),
      this.policy,
    );
    if (existing !== null) {
      this.assertIdempotency(existing, input.requestHash);
      return {
        id: existing.id,
        status: existing.status,
        estimatedMicrocredits: existing.estimated_microcredits,
      };
    }

    const budget = await this.budgetFor(input.estimate.serviceKey);
    const budgetStart =
      budget === null
        ? "1970-01-01T00:00:00.000Z"
        : periodStart(new Date(input.now), budget.period_type);
    const reservationId = crypto.randomUUID();
    const operationId = crypto.randomUUID();
    const amount = input.estimate.chargeMicrocredits;
    const budgetLimit = budget?.limit_microcredits ?? Number.MAX_SAFE_INTEGER;
    try {
      await runD1Operation(
        () =>
          this.database.batch([
            this.database
              .prepare("INSERT OR IGNORE INTO financial_wallets (account_id) VALUES (?1)")
              .bind(input.accountId),
            this.database
              .prepare(
                `INSERT INTO financial_operations (
                  id, account_id, operation_type, idempotency_scope, idempotency_key,
                  request_hash, related_entity_type, related_entity_id, created_at
                ) VALUES (?1, ?2, 'reserve', 'reservation', ?3, ?4, 'reservation', ?5, ?6)`,
              )
              .bind(
                operationId,
                input.accountId,
                input.idempotencyKey,
                input.requestHash,
                reservationId,
                input.now,
              ),
            this.database
              .prepare(
                `INSERT INTO credit_reservations (
                  id, account_id, reserve_operation_id, idempotency_key, request_hash,
                  price_version_id, pricing_item_id, service_key,
                  unit_cost_micro_uzs_snapshot, markup_multiplier_snapshot, estimated_units,
                  estimated_microcredits, reserved_microcredits, status, expires_at, created_at
                )
                SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 4, ?10, ?11, ?11,
                  'active', ?12, ?13
                WHERE (
                  SELECT COALESCE(SUM(available_microcredits), 0) FROM credit_buckets
                  WHERE account_id = ?2 AND status = 'active' AND available_microcredits > 0
                    AND (expires_at IS NULL OR expires_at > ?13)
                ) >= ?11
                AND (
                  SELECT COALESCE(SUM(
                    CASE WHEN status = 'active' THEN reserved_microcredits
                         ELSE COALESCE(actual_microcredits, 0) END
                  ), 0) FROM credit_reservations
                  WHERE service_key = ?8 AND created_at >= ?14
                ) + ?11 <= ?15`,
              )
              .bind(
                reservationId,
                input.accountId,
                operationId,
                input.idempotencyKey,
                input.requestHash,
                input.estimate.priceVersionId,
                input.estimate.pricingItemId,
                input.estimate.serviceKey,
                Math.floor(input.estimate.directCostMicroUzs / input.estimate.units),
                input.estimate.units,
                amount,
                input.expiresAt,
                input.now,
                budgetStart,
                budgetLimit,
              ),
            this.database
              .prepare(
                `INSERT INTO reservation_allocations (
                  id, reservation_id, bucket_id, allocation_order, reserved_microcredits
                )
                WITH eligible AS (
                  SELECT b.id, b.available_microcredits,
                    row_number() OVER (
                      ORDER BY ${spendingPriority}, COALESCE(b.expires_at, '9999-12-31'), b.created_at, b.id
                    ) AS allocation_order,
                    COALESCE(sum(b.available_microcredits) OVER (
                      ORDER BY ${spendingPriority}, COALESCE(b.expires_at, '9999-12-31'), b.created_at, b.id
                      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                    ), 0) AS before_amount
                  FROM credit_buckets b
                  WHERE b.account_id = ?1 AND b.status = 'active' AND b.available_microcredits > 0
                    AND (b.expires_at IS NULL OR b.expires_at > ?2)
                )
                SELECT lower(hex(randomblob(16))), ?3, id, allocation_order,
                  min(available_microcredits, ?4 - before_amount)
                FROM eligible
                WHERE before_amount < ?4 AND EXISTS (
                  SELECT 1 FROM credit_reservations WHERE id = ?3
                )`,
              )
              .bind(input.accountId, input.now, reservationId, amount),
            this.database
              .prepare(
                `INSERT INTO reservation_allocation_guards (
                  operation_id, reservation_id, expected_microcredits, allocated_microcredits
                ) VALUES (?1, ?2, ?3, (
                  SELECT COALESCE(sum(reserved_microcredits), 0)
                  FROM reservation_allocations WHERE reservation_id = ?2
                ))`,
              )
              .bind(operationId, reservationId, amount),
            this.database
              .prepare(
                `UPDATE credit_buckets SET
                  available_microcredits = available_microcredits - (
                    SELECT reserved_microcredits FROM reservation_allocations
                    WHERE reservation_id = ?1 AND bucket_id = credit_buckets.id
                  ),
                  reserved_microcredits = reserved_microcredits + (
                    SELECT reserved_microcredits FROM reservation_allocations
                    WHERE reservation_id = ?1 AND bucket_id = credit_buckets.id
                  )
                WHERE id IN (
                  SELECT bucket_id FROM reservation_allocations WHERE reservation_id = ?1
                )`,
              )
              .bind(reservationId),
            this.database
              .prepare(
                `INSERT INTO financial_ledger_entries (
                  id, operation_id, account_id, bucket_id, entry_type,
                  available_delta, reserved_delta, description, created_at
                )
                SELECT lower(hex(randomblob(16))), ?1, ?2, bucket_id, 'reserve',
                  -reserved_microcredits, reserved_microcredits, 'Credit reservation', ?3
                FROM reservation_allocations WHERE reservation_id = ?4`,
              )
              .bind(operationId, input.accountId, input.now, reservationId),
          ]),
        this.policy,
      );
      if (budget !== null) {
        await this.recordBudgetAlerts({
          scopeKey: budget.scope_key,
          periodStart: budgetStart,
          limitMicrocredits: budget.limit_microcredits,
        });
      }
      return { id: reservationId, status: "active", estimatedMicrocredits: amount };
    } catch (cause) {
      const raced = await runD1Operation(
        () =>
          this.database
            .prepare(
              "SELECT id, request_hash, status, estimated_microcredits FROM credit_reservations WHERE account_id = ?1 AND idempotency_key = ?2",
            )
            .bind(input.accountId, input.idempotencyKey)
            .first<{
              id: string;
              request_hash: string;
              status: string;
              estimated_microcredits: number;
            }>(),
        this.policy,
      );
      if (raced !== null) {
        this.assertIdempotency(raced, input.requestHash);
        return {
          id: raced.id,
          status: raced.status,
          estimatedMicrocredits: raced.estimated_microcredits,
        };
      }
      const balance = await this.getBalance(input.accountId);
      if (balance.availableMicrocredits < amount) {
        throw new AppError("INSUFFICIENT_CREDITS", "Insufficient credits", { cause });
      }
      if (budget !== null) {
        const usage = await runD1Operation(
          () =>
            this.database
              .prepare(
                `SELECT COALESCE(sum(
                  CASE WHEN status = 'active' THEN reserved_microcredits
                       ELSE COALESCE(actual_microcredits, 0) END
                ), 0) AS used
                FROM credit_reservations
                WHERE service_key = ?1 AND created_at >= ?2`,
              )
              .bind(budget.scope_key, budgetStart)
              .first<{ used: number }>(),
          this.policy,
        );
        if ((usage?.used ?? 0) + amount > budget.limit_microcredits) {
          throw new AppError("BUDGET_EXCEEDED", "Service budget is exhausted", { cause });
        }
      }
      throw cause;
    }
  }

  private async reservationRow(
    reservationId: string,
    accountId: string,
  ): Promise<{
    id: string;
    status: "active" | "settled" | "cancelled";
    reserved_microcredits: number;
    price_version_id: string;
    pricing_item_id: string;
    service_key: string;
    unit_cost_micro_uzs_snapshot: number;
    markup_multiplier_snapshot: number;
    actual_microcredits: number | null;
  }> {
    const row = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT r.id, r.status, r.reserved_microcredits, r.price_version_id,
              r.pricing_item_id, r.service_key, r.unit_cost_micro_uzs_snapshot,
              r.markup_multiplier_snapshot, r.actual_microcredits
            FROM credit_reservations r
            WHERE r.id = ?1 AND r.account_id = ?2`,
          )
          .bind(reservationId, accountId)
          .first<{
            id: string;
            status: "active" | "settled" | "cancelled";
            reserved_microcredits: number;
            price_version_id: string;
            pricing_item_id: string;
            service_key: string;
            unit_cost_micro_uzs_snapshot: number;
            markup_multiplier_snapshot: number;
            actual_microcredits: number | null;
          }>(),
      this.policy,
    );
    if (row === null) throw new AppError("NOT_FOUND", "Reservation not found");
    return row;
  }

  private async addReservationCapacity(input: {
    reservationId: string;
    accountId: string;
    additionalMicrocredits: number;
    idempotencyKey: string;
    requestHash: string;
    now: string;
  }): Promise<void> {
    const existing = await this.existingOperation(
      input.accountId,
      "reservation_topup",
      input.idempotencyKey,
    );
    this.assertIdempotency(existing, input.requestHash);
    if (existing !== null) return;
    const operationId = crypto.randomUUID();
    const currentMax = await runD1Operation(
      () =>
        this.database
          .prepare(
            "SELECT COALESCE(max(allocation_order), 0) AS max_order FROM reservation_allocations WHERE reservation_id = ?1",
          )
          .bind(input.reservationId)
          .first<{ max_order: number }>(),
      this.policy,
    );
    try {
      await runD1Operation(
        () =>
          this.database.batch([
            this.database
              .prepare(
                `INSERT INTO financial_operations (
                  id, account_id, operation_type, idempotency_scope, idempotency_key,
                  request_hash, related_entity_type, related_entity_id, created_at
                ) VALUES (?1, ?2, 'reserve', 'reservation_topup', ?3, ?4, 'reservation', ?5, ?6)`,
              )
              .bind(
                operationId,
                input.accountId,
                input.idempotencyKey,
                input.requestHash,
                input.reservationId,
                input.now,
              ),
            this.database
              .prepare(
                `INSERT INTO reservation_allocations (
                  id, reservation_id, bucket_id, allocation_order, reserved_microcredits
                )
                WITH eligible AS (
                  SELECT b.id, b.available_microcredits,
                    ?5 + row_number() OVER (
                      ORDER BY ${spendingPriority}, COALESCE(b.expires_at, '9999-12-31'), b.created_at, b.id
                    ) AS allocation_order,
                    COALESCE(sum(b.available_microcredits) OVER (
                      ORDER BY ${spendingPriority}, COALESCE(b.expires_at, '9999-12-31'), b.created_at, b.id
                      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                    ), 0) AS before_amount
                  FROM credit_buckets b
                  WHERE b.account_id = ?1 AND b.status = 'active' AND b.available_microcredits > 0
                    AND (b.expires_at IS NULL OR b.expires_at > ?2)
                )
                SELECT lower(hex(randomblob(16))), ?3, id, allocation_order,
                  min(available_microcredits, ?4 - before_amount)
                FROM eligible WHERE before_amount < ?4`,
              )
              .bind(
                input.accountId,
                input.now,
                input.reservationId,
                input.additionalMicrocredits,
                currentMax?.max_order ?? 0,
              ),
            this.database
              .prepare(
                `INSERT INTO reservation_allocation_guards (
                  operation_id, reservation_id, expected_microcredits, allocated_microcredits
                ) VALUES (?1, ?2, ?3, (
                  SELECT COALESCE(sum(reserved_microcredits), 0)
                  FROM reservation_allocations WHERE reservation_id = ?2 AND allocation_order > ?4
                ))`,
              )
              .bind(
                operationId,
                input.reservationId,
                input.additionalMicrocredits,
                currentMax?.max_order ?? 0,
              ),
            this.database
              .prepare(
                `UPDATE credit_buckets SET
                  available_microcredits = available_microcredits - (
                    SELECT sum(reserved_microcredits) FROM reservation_allocations
                    WHERE reservation_id = ?1 AND bucket_id = credit_buckets.id AND allocation_order > ?2
                  ),
                  reserved_microcredits = reserved_microcredits + (
                    SELECT sum(reserved_microcredits) FROM reservation_allocations
                    WHERE reservation_id = ?1 AND bucket_id = credit_buckets.id AND allocation_order > ?2
                  )
                WHERE id IN (
                  SELECT bucket_id FROM reservation_allocations
                  WHERE reservation_id = ?1 AND allocation_order > ?2
                )`,
              )
              .bind(input.reservationId, currentMax?.max_order ?? 0),
            this.database
              .prepare(
                `INSERT INTO financial_ledger_entries (
                  id, operation_id, account_id, bucket_id, entry_type,
                  available_delta, reserved_delta, description, created_at
                )
                SELECT lower(hex(randomblob(16))), ?1, ?2, bucket_id, 'reserve',
                  -sum(reserved_microcredits), sum(reserved_microcredits),
                  'Reservation overage approved', ?3
                FROM reservation_allocations
                WHERE reservation_id = ?4 AND allocation_order > ?5 GROUP BY bucket_id`,
              )
              .bind(
                operationId,
                input.accountId,
                input.now,
                input.reservationId,
                currentMax?.max_order ?? 0,
              ),
            this.database
              .prepare(
                "UPDATE credit_reservations SET reserved_microcredits = reserved_microcredits + ?1 WHERE id = ?2 AND status = 'active'",
              )
              .bind(input.additionalMicrocredits, input.reservationId),
          ]),
        this.policy,
      );
    } catch (cause) {
      const raced = await this.existingOperation(
        input.accountId,
        "reservation_topup",
        input.idempotencyKey,
      );
      this.assertIdempotency(raced, input.requestHash);
      if (raced === null) {
        const balance = await this.getBalance(input.accountId);
        if (balance.availableMicrocredits < input.additionalMicrocredits) {
          throw new AppError("INSUFFICIENT_CREDITS", "Insufficient credits for approved overage", {
            cause,
          });
        }
        throw cause;
      }
    }
  }

  async settleReservation(input: {
    reservationId: string;
    accountId: string;
    actualUnits: number;
    consentToAdditionalCharge: boolean;
    idempotencyKey: string;
    requestHash: string;
    now: string;
  }): Promise<{ id: string; status: string; actualMicrocredits: number }> {
    assertSafeNonNegative(input.actualUnits, "actualUnits");
    const reservation = await this.reservationRow(input.reservationId, input.accountId);
    if (reservation.status !== "active") {
      return {
        id: reservation.id,
        status: reservation.status,
        actualMicrocredits: reservation.actual_microcredits ?? 0,
      };
    }
    const directCost = reservation.unit_cost_micro_uzs_snapshot * input.actualUnits;
    const actual = directCost * reservation.markup_multiplier_snapshot;
    if (!Number.isSafeInteger(actual) || !Number.isSafeInteger(directCost)) {
      throw new AppError("VALIDATION_ERROR", "Actual cost exceeds safe integer range");
    }
    if (actual > reservation.reserved_microcredits) {
      if (!input.consentToAdditionalCharge) {
        throw new AppError("CONFLICT", "Additional charge consent is required", {
          details: {
            reservedMicrocredits: reservation.reserved_microcredits,
            actualMicrocredits: actual,
          },
        });
      }
      await this.addReservationCapacity({
        reservationId: reservation.id,
        accountId: input.accountId,
        additionalMicrocredits: actual - reservation.reserved_microcredits,
        idempotencyKey: `${input.idempotencyKey}:overage`,
        requestHash: input.requestHash,
        now: input.now,
      });
    }
    const existing = await this.existingOperation(
      input.accountId,
      "reservation_settlement",
      input.idempotencyKey,
    );
    this.assertIdempotency(existing, input.requestHash);
    if (existing !== null) {
      const current = await this.reservationRow(input.reservationId, input.accountId);
      return {
        id: current.id,
        status: current.status,
        actualMicrocredits: current.actual_microcredits ?? actual,
      };
    }

    const operationId = crypto.randomUUID();
    await runD1Operation(
      () =>
        this.database.batch([
          this.database
            .prepare(
              `INSERT INTO financial_operations (
                id, account_id, operation_type, idempotency_scope, idempotency_key,
                request_hash, related_entity_type, related_entity_id, created_at
              ) VALUES (?1, ?2, 'settle', 'reservation_settlement', ?3, ?4, 'reservation', ?5, ?6)`,
            )
            .bind(
              operationId,
              input.accountId,
              input.idempotencyKey,
              input.requestHash,
              input.reservationId,
              input.now,
            ),
          this.database
            .prepare(
              `UPDATE reservation_allocations SET
                consumed_microcredits = min(reserved_microcredits, max(0, ?1 - (
                  SELECT COALESCE(sum(previous.reserved_microcredits), 0)
                  FROM reservation_allocations previous
                  WHERE previous.reservation_id = reservation_allocations.reservation_id
                    AND previous.allocation_order < reservation_allocations.allocation_order
                ))),
                released_microcredits = reserved_microcredits - min(reserved_microcredits, max(0, ?1 - (
                  SELECT COALESCE(sum(previous.reserved_microcredits), 0)
                  FROM reservation_allocations previous
                  WHERE previous.reservation_id = reservation_allocations.reservation_id
                    AND previous.allocation_order < reservation_allocations.allocation_order
                ))),
                status = 'settled'
              WHERE reservation_id = ?2 AND status = 'active'`,
            )
            .bind(actual, input.reservationId),
          this.database
            .prepare(
              `UPDATE credit_buckets SET
                reserved_microcredits = reserved_microcredits - (
                  SELECT sum(reserved_microcredits) FROM reservation_allocations
                  WHERE reservation_id = ?1 AND bucket_id = credit_buckets.id
                ),
                consumed_microcredits = consumed_microcredits + (
                  SELECT sum(consumed_microcredits) FROM reservation_allocations
                  WHERE reservation_id = ?1 AND bucket_id = credit_buckets.id
                ),
                available_microcredits = available_microcredits + CASE
                  WHEN status = 'active' AND (expires_at IS NULL OR expires_at > ?2) THEN (
                    SELECT sum(released_microcredits) FROM reservation_allocations
                    WHERE reservation_id = ?1 AND bucket_id = credit_buckets.id
                  ) ELSE 0 END,
                expired_microcredits = expired_microcredits + CASE
                  WHEN status <> 'active' OR (expires_at IS NOT NULL AND expires_at <= ?2) THEN (
                    SELECT sum(released_microcredits) FROM reservation_allocations
                    WHERE reservation_id = ?1 AND bucket_id = credit_buckets.id
                  ) ELSE 0 END,
                status = CASE
                  WHEN status <> 'active' OR (expires_at IS NOT NULL AND expires_at <= ?2) THEN 'expired'
                  WHEN available_microcredits + (
                    SELECT sum(released_microcredits) FROM reservation_allocations
                    WHERE reservation_id = ?1 AND bucket_id = credit_buckets.id
                  ) = 0 THEN 'exhausted' ELSE 'active' END
              WHERE id IN (
                SELECT bucket_id FROM reservation_allocations WHERE reservation_id = ?1
              )`,
            )
            .bind(input.reservationId, input.now),
          this.database
            .prepare(
              `INSERT INTO financial_ledger_entries (
                id, operation_id, account_id, bucket_id, entry_type,
                available_delta, reserved_delta, consumed_delta, expired_delta,
                description, created_at
              )
              SELECT lower(hex(randomblob(16))), ?1, ?2, a.bucket_id, 'settle',
                CASE WHEN b.status = 'active' AND (b.expires_at IS NULL OR b.expires_at > ?3)
                  THEN sum(a.released_microcredits) ELSE 0 END,
                -sum(a.reserved_microcredits), sum(a.consumed_microcredits),
                CASE WHEN b.status <> 'active' OR (b.expires_at IS NOT NULL AND b.expires_at <= ?3)
                  THEN sum(a.released_microcredits) ELSE 0 END,
                'Reservation settled at actual cost', ?3
              FROM reservation_allocations a JOIN credit_buckets b ON b.id = a.bucket_id
              WHERE a.reservation_id = ?4 GROUP BY a.bucket_id`,
            )
            .bind(operationId, input.accountId, input.now, input.reservationId),
          this.database
            .prepare(
              `UPDATE credit_reservations SET status = 'settled', settlement_operation_id = ?1,
                actual_units = ?2, actual_microcredits = ?3, direct_cost_micro_uzs = ?4,
                settled_at = ?5
              WHERE id = ?6 AND status = 'active'`,
            )
            .bind(
              operationId,
              input.actualUnits,
              actual,
              directCost,
              input.now,
              input.reservationId,
            ),
        ]),
      this.policy,
    );
    return { id: input.reservationId, status: "settled", actualMicrocredits: actual };
  }

  async cancelReservation(input: {
    reservationId: string;
    accountId: string;
    idempotencyKey: string;
    requestHash: string;
    now: string;
  }): Promise<{ id: string; status: string }> {
    const result = await this.settleReservation({
      ...input,
      actualUnits: 0,
      consentToAdditionalCharge: false,
    });
    await runD1Operation(
      () =>
        this.database
          .prepare(
            "UPDATE credit_reservations SET status = 'cancelled' WHERE id = ?1 AND status = 'settled'",
          )
          .bind(input.reservationId)
          .run(),
      this.policy,
    );
    return { id: result.id, status: "cancelled" };
  }

  async releaseExpiredReservations(now: Date): Promise<number> {
    const due = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT id, account_id FROM credit_reservations
             WHERE status = 'active' AND expires_at <= ?1
             ORDER BY expires_at LIMIT 100`,
          )
          .bind(now.toISOString())
          .all<{ id: string; account_id: string }>(),
      this.policy,
    );
    let released = 0;
    for (const reservation of due.results) {
      await this.cancelReservation({
        reservationId: reservation.id,
        accountId: reservation.account_id,
        idempotencyKey: `automatic-expiry:${reservation.id}`,
        requestHash: "0".repeat(64),
        now: now.toISOString(),
      });
      released += 1;
    }
    return released;
  }

  async getReservation(accountId: string, id: string): Promise<unknown> {
    const row = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT id, service_key AS serviceKey, estimated_units AS estimatedUnits,
              estimated_microcredits AS estimatedMicrocredits,
              reserved_microcredits AS reservedMicrocredits, actual_units AS actualUnits,
              actual_microcredits AS actualMicrocredits, status, expires_at AS expiresAt,
              created_at AS createdAt, settled_at AS settledAt
            FROM credit_reservations WHERE id = ?1 AND account_id = ?2`,
          )
          .bind(id, accountId)
          .first(),
      this.policy,
    );
    if (row === null) throw new AppError("NOT_FOUND", "Reservation not found");
    return row;
  }

  async createPromo(input: {
    code: string;
    creditMicrocredits: number;
    validityDays: number;
    startsAt: string;
    endsAt: string;
    maxRedemptions: number;
    budgetMicrocredits: number;
    actorAccountId: string;
  }): Promise<string> {
    assertSafePositive(input.creditMicrocredits, "creditMicrocredits");
    assertSafePositive(input.maxRedemptions, "maxRedemptions");
    assertSafePositive(input.budgetMicrocredits, "budgetMicrocredits");
    const id = crypto.randomUUID();
    await runD1Operation(
      () =>
        this.database
          .prepare(
            `INSERT INTO promo_codes (
              id, code, credit_microcredits, credit_validity_days, starts_at, ends_at,
              max_redemptions, budget_microcredits, created_by_account_id
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
          )
          .bind(
            id,
            input.code.toUpperCase(),
            input.creditMicrocredits,
            input.validityDays,
            input.startsAt,
            input.endsAt,
            input.maxRedemptions,
            input.budgetMicrocredits,
            input.actorAccountId,
          )
          .run(),
      this.policy,
    );
    return id;
  }

  async redeemPromo(input: {
    accountId: string;
    code: string;
    requestHash: string;
    now: Date;
  }): Promise<{ promoId: string; microcredits: number; expiresAt: string }> {
    const code = input.code.toUpperCase();
    const promo = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT id, credit_microcredits, credit_validity_days FROM promo_codes
             WHERE code = ?1 AND active = 1 AND starts_at <= ?2 AND ends_at > ?2
               AND redeemed_count < max_redemptions
               AND redeemed_microcredits + credit_microcredits <= budget_microcredits`,
          )
          .bind(code, input.now.toISOString())
          .first<{ id: string; credit_microcredits: number; credit_validity_days: number }>(),
      this.policy,
    );
    if (promo === null) throw new AppError("NOT_FOUND", "Promo code is invalid or exhausted");
    const existing = await runD1Operation(
      () =>
        this.database
          .prepare("SELECT id FROM promo_redemptions WHERE promo_id = ?1 AND account_id = ?2")
          .bind(promo.id, input.accountId)
          .first<{ id: string }>(),
      this.policy,
    );
    if (existing !== null) throw new AppError("CONFLICT", "Promo code was already redeemed");
    const now = input.now.toISOString();
    const expiresAt = addDays(input.now, promo.credit_validity_days).toISOString();
    const operationId = crypto.randomUUID();
    const bucketId = crypto.randomUUID();
    try {
      await runD1Operation(
        () =>
          this.database.batch([
            this.database
              .prepare("INSERT OR IGNORE INTO financial_wallets (account_id) VALUES (?1)")
              .bind(input.accountId),
            this.database
              .prepare(
                `INSERT INTO financial_operations (
                  id, account_id, operation_type, idempotency_scope, idempotency_key,
                  request_hash, related_entity_type, related_entity_id, created_at
                )
                SELECT ?1, ?2, 'promo', 'promo_redemption', ?3, ?4,
                  'credit_bucket', ?5, ?6
                FROM promo_codes
                WHERE id = ?3 AND active = 1 AND starts_at <= ?6 AND ends_at > ?6
                  AND redeemed_count < max_redemptions
                  AND redeemed_microcredits + credit_microcredits <= budget_microcredits`,
              )
              .bind(operationId, input.accountId, promo.id, input.requestHash, bucketId, now),
            this.database
              .prepare(
                `INSERT INTO credit_buckets (
                  id, account_id, source_type, source_reference, initial_microcredits,
                  available_microcredits, expires_at, created_at
                )
                SELECT ?1, ?2, 'promo', ?3, ?4, ?4, ?5, ?6
                WHERE EXISTS (SELECT 1 FROM financial_operations WHERE id = ?7)`,
              )
              .bind(
                bucketId,
                input.accountId,
                promo.id,
                promo.credit_microcredits,
                expiresAt,
                now,
                operationId,
              ),
            this.database
              .prepare(
                `INSERT INTO financial_ledger_entries (
                  id, operation_id, account_id, bucket_id, entry_type,
                  available_delta, description, created_at
                )
                SELECT ?1, ?2, ?3, ?4, 'grant', ?5, 'Promo credit redemption', ?6
                WHERE EXISTS (SELECT 1 FROM credit_buckets WHERE id = ?4)`,
              )
              .bind(
                crypto.randomUUID(),
                operationId,
                input.accountId,
                bucketId,
                promo.credit_microcredits,
                now,
              ),
            this.database
              .prepare(
                `UPDATE promo_codes SET redeemed_count = redeemed_count + 1,
                  redeemed_microcredits = redeemed_microcredits + credit_microcredits
                WHERE id = ?1 AND EXISTS (
                  SELECT 1 FROM financial_operations WHERE id = ?2
                ) AND redeemed_count < max_redemptions
                  AND redeemed_microcredits + credit_microcredits <= budget_microcredits`,
              )
              .bind(promo.id, operationId),
            this.database
              .prepare(
                `INSERT INTO promo_redemptions (
                  id, promo_id, account_id, operation_id, bucket_id, redeemed_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
              )
              .bind(crypto.randomUUID(), promo.id, input.accountId, operationId, bucketId, now),
            this.database
              .prepare(
                `INSERT INTO financial_transaction_guards (
                  operation_id, expected_value, actual_value
                ) VALUES (?1, 1, (
                  SELECT count(*) FROM financial_operations WHERE id = ?1
                ))`,
              )
              .bind(operationId),
          ]),
        this.policy,
      );
    } catch (cause) {
      const raced = await runD1Operation(
        () =>
          this.database
            .prepare("SELECT id FROM promo_redemptions WHERE promo_id = ?1 AND account_id = ?2")
            .bind(promo.id, input.accountId)
            .first(),
        this.policy,
      );
      if (raced === null) {
        throw new AppError("CONFLICT", "Promo code capacity was exhausted", { cause });
      }
    }
    return { promoId: promo.id, microcredits: promo.credit_microcredits, expiresAt };
  }

  async getOrCreateReferralCode(accountId: string): Promise<string> {
    const existing = await runD1Operation(
      () =>
        this.database
          .prepare("SELECT code FROM referral_codes WHERE account_id = ?1")
          .bind(accountId)
          .first<{ code: string }>(),
      this.policy,
    );
    if (existing !== null) return existing.code;
    const code = `YR${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
    try {
      await runD1Operation(
        () =>
          this.database
            .prepare("INSERT INTO referral_codes (code, account_id) VALUES (?1, ?2)")
            .bind(code, accountId)
            .run(),
        this.policy,
      );
      return code;
    } catch (cause) {
      const raced = await runD1Operation(
        () =>
          this.database
            .prepare("SELECT code FROM referral_codes WHERE account_id = ?1")
            .bind(accountId)
            .first<{ code: string }>(),
        this.policy,
      );
      if (raced === null) throw cause;
      return raced.code;
    }
  }

  async applyReferral(input: {
    inviteeAccountId: string;
    code: string;
    now: Date;
  }): Promise<string> {
    const referralId = crypto.randomUUID();
    const eligibleAt = new Date(input.now.getTime() + 72 * 60 * 60 * 1_000).toISOString();
    try {
      await runD1Operation(
        () =>
          this.database
            .prepare(
              `INSERT INTO referrals (
                id, inviter_account_id, invitee_account_id, referral_code, eligible_at, created_at
              )
              SELECT ?1, account_id, ?2, code, ?3, ?4 FROM referral_codes
              WHERE code = ?5 AND account_id <> ?2`,
            )
            .bind(
              referralId,
              input.inviteeAccountId,
              eligibleAt,
              input.now.toISOString(),
              input.code.toUpperCase(),
            )
            .run(),
        this.policy,
      );
    } catch (cause) {
      throw new AppError("CONFLICT", "Referral is invalid or already assigned", { cause });
    }
    const row = await runD1Operation(
      () =>
        this.database
          .prepare("SELECT id FROM referrals WHERE invitee_account_id = ?1")
          .bind(input.inviteeAccountId)
          .first<{ id: string }>(),
      this.policy,
    );
    if (row === null) throw new AppError("VALIDATION_ERROR", "Referral code is invalid");
    return row.id;
  }

  async recordReferralActivity(referralId: string, reference: string): Promise<void> {
    await runD1Operation(
      () =>
        this.database.batch([
          this.database
            .prepare(
              "INSERT OR IGNORE INTO referral_activities (id, referral_id, activity_reference) VALUES (?1, ?2, ?3)",
            )
            .bind(crypto.randomUUID(), referralId, reference),
          this.database
            .prepare(
              `UPDATE referrals SET qualifying_operations = min(3, (
                SELECT count(*) FROM referral_activities WHERE referral_id = ?1
              )) WHERE id = ?1 AND status = 'pending'`,
            )
            .bind(referralId),
        ]),
      this.policy,
    );
  }

  async processReferralRewards(now: Date): Promise<number> {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const rows = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT r.id, r.inviter_account_id, r.invitee_account_id
            FROM referrals r
            WHERE r.status = 'pending' AND r.qualifying_operations = 3 AND r.eligible_at <= ?1
              AND (
                SELECT count(*) FROM referrals rewarded
                WHERE rewarded.inviter_account_id = r.inviter_account_id
                  AND rewarded.status = 'rewarded' AND rewarded.rewarded_at >= ?2
              ) < 100
            ORDER BY r.eligible_at LIMIT 100`,
          )
          .bind(now.toISOString(), monthStart)
          .all<{ id: string; inviter_account_id: string; invitee_account_id: string }>(),
      this.policy,
    );
    let rewarded = 0;
    for (const row of rows.results) {
      const expiry = addDays(now, 30).toISOString();
      await this.grantCredits({
        accountId: row.inviter_account_id,
        sourceType: "referral",
        sourceReference: `${row.id}:inviter`,
        microcredits: 2_000 * MICROCREDITS_PER_CREDIT,
        expiresAt: expiry,
        operationType: "referral",
        idempotencyScope: "referral_reward",
        idempotencyKey: `${row.id}:inviter`,
        requestHash: "0".repeat(64),
        description: "Referral inviter reward",
        now: now.toISOString(),
      });
      await this.grantCredits({
        accountId: row.invitee_account_id,
        sourceType: "referral",
        sourceReference: `${row.id}:invitee`,
        microcredits: 1_000 * MICROCREDITS_PER_CREDIT,
        expiresAt: expiry,
        operationType: "referral",
        idempotencyScope: "referral_reward",
        idempotencyKey: `${row.id}:invitee`,
        requestHash: "0".repeat(64),
        description: "Referral invitee reward",
        now: now.toISOString(),
      });
      await runD1Operation(
        () =>
          this.database
            .prepare(
              "UPDATE referrals SET status = 'rewarded', rewarded_at = ?1 WHERE id = ?2 AND status = 'pending'",
            )
            .bind(now.toISOString(), row.id)
            .run(),
        this.policy,
      );
      rewarded += 1;
    }
    return rewarded;
  }

  async grantSubscription(input: {
    accountId: string;
    plan: "pro" | "trial";
    durationDays: number;
    idempotencyKey: string;
    actorAccountId: string;
    now: Date;
  }): Promise<{ id: string; status: string; startsAt: string; expiresAt: string }> {
    if (
      !Number.isInteger(input.durationDays) ||
      input.durationDays < 1 ||
      input.durationDays > 365
    ) {
      throw new AppError("VALIDATION_ERROR", "Subscription duration is invalid");
    }
    const existing = await runD1Operation(
      () =>
        this.database
          .prepare(
            "SELECT id, status, starts_at, expires_at FROM subscription_contracts WHERE account_id = ?1 AND idempotency_key = ?2",
          )
          .bind(input.accountId, input.idempotencyKey)
          .first<{ id: string; status: string; starts_at: string; expires_at: string }>(),
      this.policy,
    );
    if (existing !== null) {
      return {
        id: existing.id,
        status: existing.status,
        startsAt: existing.starts_at,
        expiresAt: existing.expires_at,
      };
    }
    const latest = await runD1Operation(
      () =>
        this.database
          .prepare(
            "SELECT max(expires_at) AS expires_at FROM subscription_contracts WHERE account_id = ?1 AND status IN ('active', 'scheduled')",
          )
          .bind(input.accountId)
          .first<{ expires_at: string | null }>(),
      this.policy,
    );
    const start =
      latest?.expires_at !== null &&
      latest?.expires_at !== undefined &&
      latest.expires_at > input.now.toISOString()
        ? new Date(latest.expires_at)
        : input.now;
    const end = addDays(start, input.durationDays);
    const status = start.getTime() <= input.now.getTime() ? "active" : "scheduled";
    const id = crypto.randomUUID();
    const included = input.plan === "pro" ? PRO_CREDIT_MICROCREDITS : 0;
    try {
      await runD1Operation(
        () =>
          this.database
            .prepare(
              `INSERT INTO subscription_contracts (
                id, account_id, plan, grant_kind, status, starts_at, expires_at,
                price_uzs, included_microcredits, idempotency_key, created_by_account_id
              ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, ?8, ?9, ?10)`,
            )
            .bind(
              id,
              input.accountId,
              input.plan,
              input.plan === "trial" ? "trial" : "admin",
              status,
              start.toISOString(),
              end.toISOString(),
              included,
              input.idempotencyKey,
              input.actorAccountId,
            )
            .run(),
        this.policy,
      );
    } catch (cause) {
      const raced = await runD1Operation(
        () =>
          this.database
            .prepare(
              "SELECT id, status, starts_at, expires_at FROM subscription_contracts WHERE account_id = ?1 AND idempotency_key = ?2",
            )
            .bind(input.accountId, input.idempotencyKey)
            .first<{ id: string; status: string; starts_at: string; expires_at: string }>(),
        this.policy,
      );
      if (raced === null) throw cause;
      return {
        id: raced.id,
        status: raced.status,
        startsAt: raced.starts_at,
        expiresAt: raced.expires_at,
      };
    }
    if (status === "active" && included > 0) {
      const grant = await this.grantCredits({
        accountId: input.accountId,
        sourceType: "subscription",
        sourceReference: id,
        microcredits: included,
        expiresAt: end.toISOString(),
        operationType: "subscription",
        idempotencyScope: "subscription_credit",
        idempotencyKey: id,
        requestHash: "0".repeat(64),
        description: "Pro subscription included credits",
        now: input.now.toISOString(),
      });
      await runD1Operation(
        () =>
          this.database
            .prepare("UPDATE subscription_contracts SET credits_operation_id = ?1 WHERE id = ?2")
            .bind(grant.operationId, id)
            .run(),
        this.policy,
      );
    }
    return { id, status, startsAt: start.toISOString(), expiresAt: end.toISOString() };
  }

  async processSubscriptions(now: Date): Promise<{ expired: number; activated: number }> {
    const expired = await runD1Operation(
      () =>
        this.database
          .prepare(
            "UPDATE subscription_contracts SET status = 'expired' WHERE status = 'active' AND expires_at <= ?1",
          )
          .bind(now.toISOString())
          .run(),
      this.policy,
    );
    const due = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT s.id, s.account_id, s.expires_at, s.included_microcredits
            FROM subscription_contracts s
            WHERE s.status = 'scheduled' AND s.starts_at <= ?1
              AND NOT EXISTS (
                SELECT 1 FROM subscription_contracts active
                WHERE active.account_id = s.account_id AND active.status = 'active'
              ) ORDER BY s.starts_at LIMIT 100`,
          )
          .bind(now.toISOString())
          .all<{
            id: string;
            account_id: string;
            expires_at: string;
            included_microcredits: number;
          }>(),
      this.policy,
    );
    let activated = 0;
    for (const row of due.results) {
      await runD1Operation(
        () =>
          this.database
            .prepare(
              "UPDATE subscription_contracts SET status = 'active' WHERE id = ?1 AND status = 'scheduled'",
            )
            .bind(row.id)
            .run(),
        this.policy,
      );
      if (row.included_microcredits > 0) {
        const grant = await this.grantCredits({
          accountId: row.account_id,
          sourceType: "subscription",
          sourceReference: row.id,
          microcredits: row.included_microcredits,
          expiresAt: row.expires_at,
          operationType: "subscription",
          idempotencyScope: "subscription_credit",
          idempotencyKey: row.id,
          requestHash: "0".repeat(64),
          description: "Queued Pro subscription included credits",
          now: now.toISOString(),
        });
        await runD1Operation(
          () =>
            this.database
              .prepare("UPDATE subscription_contracts SET credits_operation_id = ?1 WHERE id = ?2")
              .bind(grant.operationId, row.id)
              .run(),
          this.policy,
        );
      }
      activated += 1;
    }
    return { expired: expired.meta.changes, activated };
  }

  async getSubscription(accountId: string, now: string): Promise<unknown> {
    const active = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT id, plan, grant_kind AS grantKind, status, starts_at AS startsAt,
              expires_at AS expiresAt, price_uzs AS priceUzs,
              included_microcredits AS includedMicrocredits
            FROM subscription_contracts
            WHERE account_id = ?1 AND status = 'active' AND expires_at > ?2`,
          )
          .bind(accountId, now)
          .first(),
      this.policy,
    );
    const queued = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT id, plan, starts_at AS startsAt, expires_at AS expiresAt
            FROM subscription_contracts WHERE account_id = ?1 AND status = 'scheduled'
            ORDER BY starts_at LIMIT 1`,
          )
          .bind(accountId)
          .first(),
      this.policy,
    );
    return { plan: active === null ? "free" : "pro", active, queued };
  }

  async grantCompensation(input: {
    accountId: string;
    originalOperationId: string;
    reason:
      "system_error" | "provider_no_result" | "duplicate_charge" | "wrong_price" | "quality_review";
    microcredits: number;
    actorAccountId: string;
    requestHash: string;
    now: Date;
  }): Promise<{ operationId: string; bucketId: string }> {
    assertSafePositive(input.microcredits, "microcredits");
    const original = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT b.source_type, b.expires_at FROM financial_ledger_entries l
             JOIN credit_buckets b ON b.id = l.bucket_id
             WHERE l.operation_id = ?1 AND l.account_id = ?2
             ORDER BY l.created_at LIMIT 1`,
          )
          .bind(input.originalOperationId, input.accountId)
          .first<{ source_type: CreditSource; expires_at: string | null }>(),
      this.policy,
    );
    if (original === null)
      throw new AppError("NOT_FOUND", "Original financial operation not found");
    const expired = original.expires_at !== null && original.expires_at <= input.now.toISOString();
    const sourceType =
      original.source_type === "purchased"
        ? "purchased"
        : expired
          ? "compensation"
          : original.source_type;
    const expiresAt =
      sourceType === "purchased"
        ? null
        : expired
          ? addDays(input.now, 7).toISOString()
          : original.expires_at;
    const grant = await this.grantCredits({
      accountId: input.accountId,
      sourceType,
      sourceReference: `comp:${input.originalOperationId}:${input.reason}`,
      microcredits: input.microcredits,
      expiresAt,
      operationType: "compensation",
      idempotencyScope: "compensation",
      idempotencyKey: `${input.originalOperationId}:${input.reason}`,
      requestHash: input.requestHash,
      description: `Compensation: ${input.reason}`,
      now: input.now.toISOString(),
    });
    await runD1Operation(
      () =>
        this.database
          .prepare(
            `INSERT OR IGNORE INTO compensation_awards (
              id, account_id, original_operation_id, operation_id, bucket_id,
              reason, microcredits, created_by_account_id, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
          )
          .bind(
            crypto.randomUUID(),
            input.accountId,
            input.originalOperationId,
            grant.operationId,
            grant.bucketId,
            input.reason,
            input.microcredits,
            input.actorAccountId,
            input.now.toISOString(),
          )
          .run(),
      this.policy,
    );
    return { operationId: grant.operationId, bucketId: grant.bucketId };
  }

  async setBudget(input: {
    scopeKey: string;
    periodType: "daily" | "monthly";
    limitMicrocredits: number;
    enabled: boolean;
    actorAccountId: string;
    now: string;
  }): Promise<void> {
    assertSafePositive(input.limitMicrocredits, "limitMicrocredits");
    await runD1Operation(
      () =>
        this.database
          .prepare(
            `INSERT INTO budget_policies (
              id, scope_key, period_type, limit_microcredits, enabled,
              created_by_account_id, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            ON CONFLICT(scope_key) DO UPDATE SET
              period_type = excluded.period_type,
              limit_microcredits = excluded.limit_microcredits,
              enabled = excluded.enabled,
              created_by_account_id = excluded.created_by_account_id,
              updated_at = excluded.updated_at`,
          )
          .bind(
            crypto.randomUUID(),
            input.scopeKey,
            input.periodType,
            input.limitMicrocredits,
            Number(input.enabled),
            input.actorAccountId,
            input.now,
          )
          .run(),
      this.policy,
    );
  }

  async recordFxRate(input: {
    currency: string;
    rateDate: string;
    microUzsPerUnit: number;
    verifiedAt: string;
    actorAccountId: string | null;
  }): Promise<void> {
    assertSafePositive(input.microUzsPerUnit, "microUzsPerUnit");
    await runD1Operation(
      () =>
        this.database
          .prepare(
            `INSERT INTO fx_rates (
              id, currency, rate_date, micro_uzs_per_unit, verified_at, created_by_account_id
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(currency, rate_date) DO UPDATE SET
              micro_uzs_per_unit = excluded.micro_uzs_per_unit,
              verified_at = excluded.verified_at,
              created_by_account_id = excluded.created_by_account_id`,
          )
          .bind(
            crypto.randomUUID(),
            input.currency.toUpperCase(),
            input.rateDate,
            input.microUzsPerUnit,
            input.verifiedAt,
            input.actorAccountId,
          )
          .run(),
      this.policy,
    );
  }

  async reconcile(actorAccountId: string | null): Promise<{
    id: string;
    status: "passed" | "failed";
    accountsChecked: number;
    mismatches: number;
  }> {
    const mismatchRows = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT account_id, id AS bucket_id FROM credit_buckets
            WHERE initial_microcredits <> available_microcredits + reserved_microcredits +
              consumed_microcredits + expired_microcredits
              OR available_microcredits < 0 OR reserved_microcredits < 0
            LIMIT 100`,
          )
          .all<{ account_id: string; bucket_id: string }>(),
      this.policy,
    );
    const count = await runD1Operation(
      () =>
        this.database
          .prepare("SELECT count(DISTINCT account_id) AS count FROM financial_wallets")
          .first<{ count: number }>(),
      this.policy,
    );
    const id = crypto.randomUUID();
    const status = mismatchRows.results.length === 0 ? "passed" : "failed";
    await runD1Operation(
      () =>
        this.database
          .prepare(
            `INSERT INTO reconciliation_runs (
              id, status, accounts_checked, mismatches, details_json, created_by_account_id
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
          )
          .bind(
            id,
            status,
            count?.count ?? 0,
            mismatchRows.results.length,
            JSON.stringify({ buckets: mismatchRows.results }),
            actorAccountId,
          )
          .run(),
      this.policy,
    );
    return {
      id,
      status,
      accountsChecked: count?.count ?? 0,
      mismatches: mismatchRows.results.length,
    };
  }

  async analytics(): Promise<unknown> {
    const totals = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT
              COALESCE(sum(actual_microcredits), 0) AS charged_microcredits,
              COALESCE(sum(direct_cost_micro_uzs), 0) AS direct_cost_micro_uzs,
              count(*) AS settled_reservations
            FROM credit_reservations WHERE status = 'settled'`,
          )
          .first<{
            charged_microcredits: number;
            direct_cost_micro_uzs: number;
            settled_reservations: number;
          }>(),
      this.policy,
    );
    const payments = await runD1Operation(
      () =>
        this.database
          .prepare(
            "SELECT COALESCE(sum(amount_uzs), 0) AS revenue_uzs FROM payment_intents WHERE status = 'Completed'",
          )
          .first<{ revenue_uzs: number }>(),
      this.policy,
    );
    const chargeCredits = (totals?.charged_microcredits ?? 0) / MICROCREDITS_PER_CREDIT;
    const directCostUzs = (totals?.direct_cost_micro_uzs ?? 0) / MICROCREDITS_PER_CREDIT;
    return {
      recognizedRevenueUzs: payments?.revenue_uzs ?? 0,
      chargedCredits: chargeCredits,
      directCostUzs,
      directMarginPercent:
        chargeCredits === 0 ? null : ((chargeCredits - directCostUzs) / chargeCredits) * 100,
      settledReservations: totals?.settled_reservations ?? 0,
      targets: {
        directMarginPercent: 60,
        operatingMarginPercent: 25,
        conversionPercent: 5,
        ltvCacRatio: 3,
        measured: false,
      },
    };
  }
}
