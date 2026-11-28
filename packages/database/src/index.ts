import type { FeatureFlagKey } from "@yuristim/config";
import { AppError } from "@yuristim/errors";
import { runD1Operation, type D1ExecutionPolicy } from "./execution";

export type FeatureFlagSnapshot = Record<FeatureFlagKey, boolean>;

export interface FeatureFlagRepository {
  getAll(): Promise<FeatureFlagSnapshot>;
  isEnabled(key: FeatureFlagKey): Promise<boolean>;
}

const falseFlagSnapshot = (): FeatureFlagSnapshot => ({
  ai_provider_execution: false,
  research_execution: false,
  real_payments: false,
  credit_purchases: false,
  pro_subscription_purchases: false,
  public_lawyer_registration: false,
  document_uploads: false,
  production_telegram_webhook: false,
  account_export_execution: false,
  account_deletion_execution: false,
  financial_reservations: false,
  promo_redemption: false,
  referral_rewards: false,
  weekly_credit_grants: false,
  legal_knowledge_search: false,
  legal_semantic_search: false,
});

export class D1FeatureFlagRepository implements FeatureFlagRepository {
  constructor(
    private readonly database: D1Database,
    private readonly policy: D1ExecutionPolicy,
  ) {}

  async getAll(): Promise<FeatureFlagSnapshot> {
    const snapshot = falseFlagSnapshot();
    const result = await runD1Operation(
      () =>
        this.database
          .prepare("SELECT key, enabled FROM feature_flags ORDER BY key")
          .all<{ key: FeatureFlagKey; enabled: number }>(),
      this.policy,
    );

    for (const row of result.results) {
      if (Object.hasOwn(snapshot, row.key)) snapshot[row.key] = row.enabled === 1;
    }
    return snapshot;
  }

  async isEnabled(key: FeatureFlagKey): Promise<boolean> {
    const row = await runD1Operation(
      () =>
        this.database
          .prepare("SELECT enabled FROM feature_flags WHERE key = ?1")
          .bind(key)
          .first<{ enabled: number }>(),
      this.policy,
    );
    return row?.enabled === 1;
  }
}

export const assertDatabaseReady = async (
  database: D1Database,
  policy: D1ExecutionPolicy,
): Promise<void> => {
  try {
    const result = await runD1Operation(
      () => database.prepare("SELECT 1 AS ok").first<{ ok: number }>(),
      policy,
    );
    if (result?.ok !== 1) throw new Error("Unexpected D1 readiness result");
  } catch (cause) {
    if (cause instanceof AppError) throw cause;
    throw new AppError("SERVICE_UNAVAILABLE", "Database is unavailable", { cause });
  }
};

export const findSystemSetting = async (
  database: D1Database,
  key: string,
  policy: D1ExecutionPolicy,
): Promise<string | null> => {
  const row = await runD1Operation(
    () =>
      database
        .prepare("SELECT value_json FROM system_settings WHERE key = ?1")
        .bind(key)
        .first<{ value_json: string }>(),
    policy,
  );
  return row?.value_json ?? null;
};

export * from "./account";
export * from "./ai";
export * from "./execution";
export * from "./financial";
export * from "./legal";
