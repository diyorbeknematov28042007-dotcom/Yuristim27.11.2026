PRAGMA foreign_keys = ON;

CREATE TABLE accounts (
  id TEXT PRIMARY KEY NOT NULL,
  telegram_user_id INTEGER NOT NULL UNIQUE CHECK (telegram_user_id > 0),
  telegram_username TEXT CHECK (telegram_username IS NULL OR length(telegram_username) BETWEEN 1 AND 64),
  telegram_display_name TEXT CHECK (telegram_display_name IS NULL OR length(telegram_display_name) BETWEEN 1 AND 128),
  display_name TEXT CHECK (display_name IS NULL OR length(display_name) BETWEEN 1 AND 64),
  language_code TEXT CHECK (language_code IS NULL OR length(language_code) BETWEEN 2 AND 16),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'restricted', 'suspended', 'banned', 'deletion_pending', 'deleted')),
  onboarding_completed INTEGER NOT NULL DEFAULT 0 CHECK (onboarding_completed IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_authenticated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_accounts_status ON accounts(status, created_at);

CREATE TABLE account_settings (
  account_id TEXT PRIMARY KEY NOT NULL,
  locale TEXT NOT NULL DEFAULT 'uz' CHECK (locale IN ('uz', 'ru', 'en')),
  notifications_enabled INTEGER NOT NULL DEFAULT 1 CHECK (notifications_enabled IN (0, 1)),
  security_alerts_enabled INTEGER NOT NULL DEFAULT 1 CHECK (security_alerts_enabled IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE account_consents (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('terms', 'privacy', 'marketing')),
  document_version TEXT NOT NULL CHECK (length(document_version) BETWEEN 1 AND 64),
  granted INTEGER NOT NULL CHECK (granted IN (0, 1)),
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (account_id, consent_type, document_version),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX idx_account_consents_account ON account_consents(account_id, recorded_at);

CREATE TABLE account_roles (
  account_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'owner', 'super_admin', 'admin', 'moderator', 'support')),
  granted_by_account_id TEXT,
  granted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (account_id, role),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) STRICT;

CREATE UNIQUE INDEX idx_single_owner_role ON account_roles(role) WHERE role = 'owner';

CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  csrf_hash TEXT CHECK (csrf_hash IS NULL OR length(csrf_hash) = 64),
  platform TEXT NOT NULL CHECK (platform IN ('web', 'mini_app', 'bot', 'admin')),
  device_id TEXT CHECK (device_id IS NULL OR length(device_id) <= 128),
  device_name TEXT CHECK (device_name IS NULL OR length(device_name) <= 128),
  user_agent_hash TEXT CHECK (user_agent_hash IS NULL OR length(user_agent_hash) = 64),
  ip_hash TEXT CHECK (ip_hash IS NULL OR length(ip_hash) = 64),
  admin_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  revoke_reason TEXT CHECK (revoke_reason IS NULL OR length(revoke_reason) <= 64),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX idx_auth_sessions_account ON auth_sessions(account_id, revoked_at, expires_at);
CREATE INDEX idx_auth_sessions_expiry ON auth_sessions(expires_at);

CREATE TABLE auth_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  challenge_type TEXT NOT NULL CHECK (challenge_type IN ('oidc_login', 'telegram_recovery', 'totp_setup', 'account_deletion')),
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  account_id TEXT,
  secret_ciphertext TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 20),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX idx_auth_challenges_expiry ON auth_challenges(challenge_type, expires_at, consumed_at);

CREATE TABLE auth_replay_nonces (
  nonce_hash TEXT PRIMARY KEY NOT NULL CHECK (length(nonce_hash) = 64),
  source TEXT NOT NULL CHECK (source IN ('mini_app', 'web_oidc', 'bot_adapter', 'recovery')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL
) STRICT;

CREATE INDEX idx_auth_replay_nonces_expiry ON auth_replay_nonces(expires_at);

CREATE TABLE auth_rate_limits (
  key_hash TEXT NOT NULL CHECK (length(key_hash) = 64),
  scope TEXT NOT NULL CHECK (length(scope) BETWEEN 1 AND 64),
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count > 0),
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (key_hash, scope, window_start)
) STRICT;

CREATE INDEX idx_auth_rate_limits_expiry ON auth_rate_limits(expires_at);

CREATE TABLE admin_totp_credentials (
  account_id TEXT PRIMARY KEY NOT NULL,
  secret_ciphertext TEXT NOT NULL,
  confirmed_at TEXT,
  last_used_step INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE security_events (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT,
  session_id TEXT,
  event_type TEXT NOT NULL CHECK (length(event_type) BETWEEN 1 AND 64),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  request_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (session_id) REFERENCES auth_sessions(id) ON DELETE SET NULL
) STRICT;

CREATE INDEX idx_security_events_account ON security_events(account_id, created_at);
CREATE INDEX idx_security_events_created ON security_events(created_at);

CREATE TRIGGER security_events_no_update
BEFORE UPDATE ON security_events
BEGIN
  SELECT RAISE(ABORT, 'security_events are append-only');
END;

CREATE TRIGGER security_events_no_delete
BEFORE DELETE ON security_events
BEGIN
  SELECT RAISE(ABORT, 'security_events are append-only');
END;

CREATE TABLE privacy_requests (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('export', 'deletion')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'blocked_storage', 'processing', 'completed', 'cancelled', 'failed')),
  requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at TEXT,
  expires_at TEXT,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX idx_privacy_requests_account ON privacy_requests(account_id, request_type, requested_at);

UPDATE system_settings SET value_json = '"authentication_account"', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE key = 'platform_status';
