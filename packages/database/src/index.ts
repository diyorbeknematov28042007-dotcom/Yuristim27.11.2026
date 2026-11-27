import type { FeatureFlagKey } from "@yuristim/config";
import { AppError } from "@yuristim/errors";

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
});

export class D1FeatureFlagRepository implements FeatureFlagRepository {
  constructor(private readonly database: D1Database) {}

  async getAll(): Promise<FeatureFlagSnapshot> {
    const snapshot = falseFlagSnapshot();
    const result = await this.database
      .prepare("SELECT key, enabled FROM feature_flags ORDER BY key")
      .all<{ key: FeatureFlagKey; enabled: number }>();

    for (const row of result.results) {
      if (Object.hasOwn(snapshot, row.key)) snapshot[row.key] = row.enabled === 1;
    }
    return snapshot;
  }

  async isEnabled(key: FeatureFlagKey): Promise<boolean> {
    const row = await this.database
      .prepare("SELECT enabled FROM feature_flags WHERE key = ?1")
      .bind(key)
      .first<{ enabled: number }>();
    return row?.enabled === 1;
  }
}

export const assertDatabaseReady = async (database: D1Database): Promise<void> => {
  try {
    const result = await database.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    if (result?.ok !== 1) throw new Error("Unexpected D1 readiness result");
  } catch (cause) {
    throw new AppError("SERVICE_UNAVAILABLE", "Database is unavailable", { cause });
  }
};

export const findSystemSetting = async (
  database: D1Database,
  key: string,
): Promise<string | null> => {
  const row = await database
    .prepare("SELECT value_json FROM system_settings WHERE key = ?1")
    .bind(key)
    .first<{ value_json: string }>();
  return row?.value_json ?? null;
};
