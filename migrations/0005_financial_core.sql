PRAGMA foreign_keys = ON;

CREATE TABLE financial_wallets (
  account_id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE financial_operations (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN (
    'grant', 'reserve', 'settle', 'release', 'expire', 'compensation',
    'promo', 'referral', 'subscription', 'admin_grant'
  )),
  idempotency_scope TEXT NOT NULL CHECK (length(idempotency_scope) BETWEEN 1 AND 64),
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 128),
  request_hash TEXT NOT NULL CHECK (length(request_hash) = 64),
  related_entity_type TEXT,
  related_entity_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (account_id, idempotency_scope, idempotency_key),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX idx_financial_operations_account ON financial_operations(account_id, created_at DESC);

CREATE TABLE credit_buckets (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'weekly', 'compensation', 'promo', 'referral', 'subscription', 'purchased', 'admin_bonus'
  )),
  source_reference TEXT NOT NULL CHECK (length(source_reference) BETWEEN 1 AND 128),
  initial_microcredits INTEGER NOT NULL CHECK (initial_microcredits > 0),
  available_microcredits INTEGER NOT NULL CHECK (available_microcredits >= 0),
  reserved_microcredits INTEGER NOT NULL DEFAULT 0 CHECK (reserved_microcredits >= 0),
  consumed_microcredits INTEGER NOT NULL DEFAULT 0 CHECK (consumed_microcredits >= 0),
  expired_microcredits INTEGER NOT NULL DEFAULT 0 CHECK (expired_microcredits >= 0),
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exhausted', 'expired')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (
    initial_microcredits = available_microcredits + reserved_microcredits +
      consumed_microcredits + expired_microcredits
  ),
  UNIQUE (account_id, source_type, source_reference),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX idx_credit_buckets_spending ON credit_buckets(
  account_id, status, source_type, expires_at, created_at
);
CREATE INDEX idx_credit_buckets_expiry ON credit_buckets(expires_at, status);

CREATE TABLE financial_ledger_entries (
  id TEXT PRIMARY KEY NOT NULL,
  operation_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  bucket_id TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'grant', 'reserve', 'settle', 'release', 'expire', 'compensation', 'correction'
  )),
  available_delta INTEGER NOT NULL DEFAULT 0,
  reserved_delta INTEGER NOT NULL DEFAULT 0,
  consumed_delta INTEGER NOT NULL DEFAULT 0,
  expired_delta INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 256),
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (operation_id, bucket_id, entry_type),
  FOREIGN KEY (operation_id) REFERENCES financial_operations(id) ON DELETE RESTRICT,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (bucket_id) REFERENCES credit_buckets(id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX idx_financial_ledger_account ON financial_ledger_entries(account_id, created_at DESC);
CREATE INDEX idx_financial_ledger_operation ON financial_ledger_entries(operation_id);

CREATE TRIGGER financial_ledger_no_update
BEFORE UPDATE ON financial_ledger_entries
BEGIN
  SELECT RAISE(ABORT, 'financial ledger is append-only');
END;

CREATE TRIGGER financial_ledger_no_delete
BEFORE DELETE ON financial_ledger_entries
BEGIN
  SELECT RAISE(ABORT, 'financial ledger is append-only');
END;

CREATE TABLE weekly_credit_grants (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  week_start TEXT NOT NULL,
  operation_id TEXT NOT NULL UNIQUE,
  bucket_id TEXT NOT NULL UNIQUE,
  granted_microcredits INTEGER NOT NULL CHECK (granted_microcredits = 2000000000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (account_id, week_start),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (operation_id) REFERENCES financial_operations(id) ON DELETE RESTRICT,
  FOREIGN KEY (bucket_id) REFERENCES credit_buckets(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE subscription_contracts (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('pro', 'trial')),
  grant_kind TEXT NOT NULL CHECK (grant_kind IN ('admin', 'trial', 'payment')),
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'active', 'expired', 'revoked')),
  starts_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  price_uzs INTEGER NOT NULL CHECK (price_uzs >= 0),
  included_microcredits INTEGER NOT NULL CHECK (included_microcredits >= 0),
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 128),
  credits_operation_id TEXT,
  created_by_account_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (expires_at > starts_at),
  UNIQUE (account_id, idempotency_key),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (credits_operation_id) REFERENCES financial_operations(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) STRICT;

CREATE UNIQUE INDEX idx_subscription_one_active ON subscription_contracts(account_id)
WHERE status = 'active';
CREATE INDEX idx_subscription_due ON subscription_contracts(status, starts_at, expires_at);

CREATE TABLE pricing_versions (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL UNIQUE CHECK (version > 0),
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'retired')),
  markup_multiplier INTEGER NOT NULL DEFAULT 4 CHECK (markup_multiplier = 4),
  effective_at TEXT NOT NULL,
  created_by_account_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (created_by_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) STRICT;

CREATE UNIQUE INDEX idx_pricing_one_active ON pricing_versions(status) WHERE status = 'active';

CREATE TABLE pricing_items (
  id TEXT PRIMARY KEY NOT NULL,
  version_id TEXT NOT NULL,
  price_key TEXT NOT NULL CHECK (length(price_key) BETWEEN 1 AND 96),
  service_key TEXT NOT NULL CHECK (length(service_key) BETWEEN 1 AND 64),
  provider TEXT NOT NULL CHECK (length(provider) BETWEEN 1 AND 64),
  unit_name TEXT NOT NULL CHECK (length(unit_name) BETWEEN 1 AND 64),
  pricing_type TEXT NOT NULL CHECK (pricing_type IN ('measured', 'allocated')),
  unit_cost_microunits INTEGER NOT NULL CHECK (unit_cost_microunits >= 0),
  currency TEXT NOT NULL DEFAULT 'UZS' CHECK (length(currency) = 3),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (version_id, price_key),
  FOREIGN KEY (version_id) REFERENCES pricing_versions(id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX idx_pricing_items_lookup ON pricing_items(price_key, version_id);

CREATE TABLE fx_rates (
  id TEXT PRIMARY KEY NOT NULL,
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  rate_date TEXT NOT NULL,
  micro_uzs_per_unit INTEGER NOT NULL CHECK (micro_uzs_per_unit > 0),
  source TEXT NOT NULL DEFAULT 'CBU' CHECK (source = 'CBU'),
  verified_at TEXT NOT NULL,
  created_by_account_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (currency, rate_date),
  FOREIGN KEY (created_by_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE budget_policies (
  id TEXT PRIMARY KEY NOT NULL,
  scope_key TEXT NOT NULL UNIQUE CHECK (length(scope_key) BETWEEN 1 AND 64),
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'monthly')),
  limit_microcredits INTEGER NOT NULL CHECK (limit_microcredits > 0),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_by_account_id TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (created_by_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE budget_alerts (
  id TEXT PRIMARY KEY NOT NULL,
  scope_key TEXT NOT NULL,
  period_start TEXT NOT NULL,
  threshold_percent INTEGER NOT NULL CHECK (threshold_percent IN (50, 75, 90, 100)),
  observed_microcredits INTEGER NOT NULL CHECK (observed_microcredits >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (scope_key, period_start, threshold_percent)
) STRICT;

CREATE TABLE credit_reservations (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  reserve_operation_id TEXT NOT NULL UNIQUE,
  settlement_operation_id TEXT UNIQUE,
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 128),
  request_hash TEXT NOT NULL CHECK (length(request_hash) = 64),
  price_version_id TEXT NOT NULL,
  pricing_item_id TEXT NOT NULL,
  service_key TEXT NOT NULL,
  unit_cost_micro_uzs_snapshot INTEGER NOT NULL CHECK (unit_cost_micro_uzs_snapshot >= 0),
  markup_multiplier_snapshot INTEGER NOT NULL DEFAULT 4 CHECK (markup_multiplier_snapshot = 4),
  estimated_units INTEGER NOT NULL CHECK (estimated_units > 0),
  estimated_microcredits INTEGER NOT NULL CHECK (estimated_microcredits > 0),
  reserved_microcredits INTEGER NOT NULL CHECK (reserved_microcredits > 0),
  actual_units INTEGER CHECK (actual_units IS NULL OR actual_units >= 0),
  actual_microcredits INTEGER CHECK (actual_microcredits IS NULL OR actual_microcredits >= 0),
  direct_cost_micro_uzs INTEGER CHECK (direct_cost_micro_uzs IS NULL OR direct_cost_micro_uzs >= 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'settled', 'cancelled')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  settled_at TEXT,
  UNIQUE (account_id, idempotency_key),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (reserve_operation_id) REFERENCES financial_operations(id) ON DELETE RESTRICT,
  FOREIGN KEY (settlement_operation_id) REFERENCES financial_operations(id) ON DELETE RESTRICT,
  FOREIGN KEY (price_version_id) REFERENCES pricing_versions(id) ON DELETE RESTRICT,
  FOREIGN KEY (pricing_item_id) REFERENCES pricing_items(id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX idx_credit_reservations_account ON credit_reservations(account_id, status, created_at DESC);
CREATE INDEX idx_credit_reservations_expiry ON credit_reservations(status, expires_at);

CREATE TABLE reservation_allocations (
  id TEXT PRIMARY KEY NOT NULL,
  reservation_id TEXT NOT NULL,
  bucket_id TEXT NOT NULL,
  allocation_order INTEGER NOT NULL CHECK (allocation_order > 0),
  reserved_microcredits INTEGER NOT NULL CHECK (reserved_microcredits > 0),
  consumed_microcredits INTEGER NOT NULL DEFAULT 0 CHECK (consumed_microcredits >= 0),
  released_microcredits INTEGER NOT NULL DEFAULT 0 CHECK (released_microcredits >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'settled', 'released')),
  CHECK (reserved_microcredits = consumed_microcredits + released_microcredits OR status = 'active'),
  UNIQUE (reservation_id, bucket_id, allocation_order),
  FOREIGN KEY (reservation_id) REFERENCES credit_reservations(id) ON DELETE RESTRICT,
  FOREIGN KEY (bucket_id) REFERENCES credit_buckets(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE reservation_allocation_guards (
  operation_id TEXT PRIMARY KEY NOT NULL,
  reservation_id TEXT NOT NULL,
  expected_microcredits INTEGER NOT NULL CHECK (expected_microcredits > 0),
  allocated_microcredits INTEGER NOT NULL CHECK (allocated_microcredits > 0),
  CHECK (expected_microcredits = allocated_microcredits),
  FOREIGN KEY (operation_id) REFERENCES financial_operations(id) ON DELETE RESTRICT,
  FOREIGN KEY (reservation_id) REFERENCES credit_reservations(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE financial_transaction_guards (
  operation_id TEXT PRIMARY KEY NOT NULL,
  expected_value INTEGER NOT NULL,
  actual_value INTEGER NOT NULL,
  CHECK (expected_value = actual_value),
  FOREIGN KEY (operation_id) REFERENCES financial_operations(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE promo_codes (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE CHECK (code = upper(code) AND length(code) BETWEEN 4 AND 32),
  credit_microcredits INTEGER NOT NULL CHECK (credit_microcredits > 0),
  credit_validity_days INTEGER NOT NULL DEFAULT 30 CHECK (credit_validity_days BETWEEN 1 AND 365),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  max_redemptions INTEGER NOT NULL CHECK (max_redemptions > 0),
  budget_microcredits INTEGER NOT NULL CHECK (budget_microcredits > 0),
  redeemed_count INTEGER NOT NULL DEFAULT 0 CHECK (redeemed_count >= 0),
  redeemed_microcredits INTEGER NOT NULL DEFAULT 0 CHECK (redeemed_microcredits >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_by_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (ends_at > starts_at),
  CHECK (redeemed_microcredits <= budget_microcredits),
  FOREIGN KEY (created_by_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE promo_redemptions (
  id TEXT PRIMARY KEY NOT NULL,
  promo_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  operation_id TEXT NOT NULL UNIQUE,
  bucket_id TEXT NOT NULL UNIQUE,
  redeemed_at TEXT NOT NULL,
  UNIQUE (promo_id, account_id),
  FOREIGN KEY (promo_id) REFERENCES promo_codes(id) ON DELETE RESTRICT,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (operation_id) REFERENCES financial_operations(id) ON DELETE RESTRICT,
  FOREIGN KEY (bucket_id) REFERENCES credit_buckets(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE referral_codes (
  code TEXT PRIMARY KEY NOT NULL CHECK (code = upper(code) AND length(code) BETWEEN 6 AND 16),
  account_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE referrals (
  id TEXT PRIMARY KEY NOT NULL,
  inviter_account_id TEXT NOT NULL,
  invitee_account_id TEXT NOT NULL UNIQUE,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rewarded', 'rejected')),
  qualifying_operations INTEGER NOT NULL DEFAULT 0 CHECK (qualifying_operations BETWEEN 0 AND 3),
  eligible_at TEXT NOT NULL,
  rewarded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (inviter_account_id <> invitee_account_id),
  FOREIGN KEY (inviter_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (invitee_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (referral_code) REFERENCES referral_codes(code) ON DELETE RESTRICT
) STRICT;

CREATE INDEX idx_referrals_eligibility ON referrals(status, qualifying_operations, eligible_at);

CREATE TABLE referral_activities (
  id TEXT PRIMARY KEY NOT NULL,
  referral_id TEXT NOT NULL,
  activity_reference TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (referral_id, activity_reference),
  FOREIGN KEY (referral_id) REFERENCES referrals(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE compensation_awards (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  original_operation_id TEXT NOT NULL,
  operation_id TEXT NOT NULL UNIQUE,
  bucket_id TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL CHECK (reason IN (
    'system_error', 'provider_no_result', 'duplicate_charge', 'wrong_price', 'quality_review'
  )),
  microcredits INTEGER NOT NULL CHECK (microcredits > 0),
  created_by_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (account_id, original_operation_id, reason),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (original_operation_id) REFERENCES financial_operations(id) ON DELETE RESTRICT,
  FOREIGN KEY (operation_id) REFERENCES financial_operations(id) ON DELETE RESTRICT,
  FOREIGN KEY (bucket_id) REFERENCES credit_buckets(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE payment_intents (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  provider TEXT,
  provider_reference TEXT UNIQUE,
  amount_uzs INTEGER NOT NULL CHECK (amount_uzs > 0),
  credit_microcredits INTEGER NOT NULL CHECK (credit_microcredits > 0),
  status TEXT NOT NULL CHECK (status IN (
    'Created', 'Pending', 'Verified', 'Processing', 'Completed', 'Failed',
    'Cancelled', 'Expired', 'Refunded', 'Disputed'
  )),
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (account_id, idempotency_key),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE reconciliation_runs (
  id TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed')),
  accounts_checked INTEGER NOT NULL CHECK (accounts_checked >= 0),
  mismatches INTEGER NOT NULL CHECK (mismatches >= 0),
  details_json TEXT NOT NULL CHECK (json_valid(details_json)),
  created_by_account_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (created_by_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) STRICT;

INSERT INTO system_settings (key, value_json) VALUES
  ('financial_microcredits_per_credit', '1000000'),
  ('financial_direct_cost_multiplier', '4'),
  ('financial_timezone', '"Asia/Tashkent"');

UPDATE system_settings
SET value_json = '"financial_core"', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE key = 'platform_status';
