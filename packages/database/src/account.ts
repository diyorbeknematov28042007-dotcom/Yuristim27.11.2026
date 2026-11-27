import { AppError } from "@yuristim/errors";
import { runD1Operation, type D1ExecutionPolicy } from "./execution";

export type AccountStatus =
  "active" | "restricted" | "suspended" | "banned" | "deletion_pending" | "deleted";

export type SessionPlatform = "web" | "mini_app" | "bot" | "admin";

export type AccountRecord = {
  id: string;
  telegramUserId: string;
  telegramUsername: string | null;
  telegramDisplayName: string | null;
  displayName: string | null;
  languageCode: string | null;
  status: AccountStatus;
  onboardingCompleted: boolean;
  locale: "uz" | "ru" | "en";
  notificationsEnabled: boolean;
  securityAlertsEnabled: boolean;
  createdAt: string;
};

export type SessionRecord = {
  id: string;
  accountId: string;
  tokenHash: string;
  csrfHash: string | null;
  platform: SessionPlatform;
  deviceId: string | null;
  deviceName: string | null;
  adminVerifiedAt: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  roles: string[];
  accountStatus: AccountStatus;
};

type AccountRow = {
  id: string;
  telegram_user_id: number;
  telegram_username: string | null;
  telegram_display_name: string | null;
  display_name: string | null;
  language_code: string | null;
  status: AccountStatus;
  onboarding_completed: number;
  locale: "uz" | "ru" | "en";
  notifications_enabled: number;
  security_alerts_enabled: number;
  created_at: string;
};

const mapAccount = (row: AccountRow): AccountRecord => ({
  id: row.id,
  telegramUserId: String(row.telegram_user_id),
  telegramUsername: row.telegram_username,
  telegramDisplayName: row.telegram_display_name,
  displayName: row.display_name,
  languageCode: row.language_code,
  status: row.status,
  onboardingCompleted: row.onboarding_completed === 1,
  locale: row.locale,
  notificationsEnabled: row.notifications_enabled === 1,
  securityAlertsEnabled: row.security_alerts_enabled === 1,
  createdAt: row.created_at,
});

export class D1AccountRepository {
  constructor(
    private readonly database: D1Database,
    private readonly policy: D1ExecutionPolicy,
  ) {}

  async consumeReplayNonce(input: {
    nonceHash: string;
    source: "mini_app" | "web_oidc" | "bot_adapter" | "recovery";
    expiresAt: string;
  }): Promise<void> {
    try {
      await runD1Operation(
        () =>
          this.database
            .prepare(
              "INSERT INTO auth_replay_nonces (nonce_hash, source, expires_at) VALUES (?1, ?2, ?3)",
            )
            .bind(input.nonceHash, input.source, input.expiresAt)
            .run(),
        this.policy,
      );
    } catch (cause) {
      throw new AppError("UNAUTHORIZED", "Authentication replay detected", { cause });
    }
  }

  async upsertTelegramAccount(input: {
    telegramUserId: string;
    username?: string;
    telegramDisplayName?: string;
    languageCode?: string;
    now: string;
  }): Promise<AccountRecord> {
    const id = crypto.randomUUID();
    const row = await runD1Operation(
      () =>
        this.database
          .prepare(
            `INSERT INTO accounts (
              id, telegram_user_id, telegram_username, telegram_display_name, language_code, last_authenticated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(telegram_user_id) DO UPDATE SET
              telegram_username = excluded.telegram_username,
              telegram_display_name = excluded.telegram_display_name,
              language_code = COALESCE(excluded.language_code, accounts.language_code),
              last_authenticated_at = excluded.last_authenticated_at,
              updated_at = excluded.last_authenticated_at
            RETURNING id`,
          )
          .bind(
            id,
            Number(input.telegramUserId),
            input.username ?? null,
            input.telegramDisplayName ?? null,
            input.languageCode ?? null,
            input.now,
          )
          .first<{ id: string }>(),
      this.policy,
    );
    if (row === null) throw new AppError("SERVICE_UNAVAILABLE", "Account persistence failed");
    await runD1Operation(
      () =>
        this.database.batch([
          this.database
            .prepare("INSERT OR IGNORE INTO account_settings (account_id) VALUES (?1)")
            .bind(row.id),
          this.database
            .prepare("INSERT OR IGNORE INTO account_roles (account_id, role) VALUES (?1, 'user')")
            .bind(row.id),
        ]),
      this.policy,
    );
    return this.getAccount(row.id);
  }

  async getAccount(accountId: string): Promise<AccountRecord> {
    const row = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT a.id, a.telegram_user_id, a.telegram_username, a.telegram_display_name,
              a.display_name, a.language_code, a.status, a.onboarding_completed, a.created_at,
              s.locale, s.notifications_enabled, s.security_alerts_enabled
            FROM accounts a JOIN account_settings s ON s.account_id = a.id WHERE a.id = ?1`,
          )
          .bind(accountId)
          .first<AccountRow>(),
      this.policy,
    );
    if (row === null) throw new AppError("NOT_FOUND", "Account not found");
    return mapAccount(row);
  }

  async findAccountByTelegramUserId(telegramUserId: string): Promise<AccountRecord | null> {
    const row = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT a.id, a.telegram_user_id, a.telegram_username, a.telegram_display_name,
              a.display_name, a.language_code, a.status, a.onboarding_completed, a.created_at,
              s.locale, s.notifications_enabled, s.security_alerts_enabled
            FROM accounts a JOIN account_settings s ON s.account_id = a.id WHERE a.telegram_user_id = ?1`,
          )
          .bind(Number(telegramUserId))
          .first<AccountRow>(),
      this.policy,
    );
    return row === null ? null : mapAccount(row);
  }

  async grantRole(
    accountId: string,
    role: "owner" | "super_admin" | "admin" | "moderator" | "support",
  ): Promise<void> {
    await runD1Operation(
      () =>
        this.database
          .prepare("INSERT OR IGNORE INTO account_roles (account_id, role) VALUES (?1, ?2)")
          .bind(accountId, role)
          .run(),
      this.policy,
    );
  }

  async completeOnboarding(
    accountId: string,
    displayName: string,
    now: string,
  ): Promise<AccountRecord> {
    await runD1Operation(
      () =>
        this.database
          .prepare(
            "UPDATE accounts SET display_name = ?1, onboarding_completed = 1, updated_at = ?2 WHERE id = ?3 AND status = 'active'",
          )
          .bind(displayName, now, accountId)
          .run(),
      this.policy,
    );
    return this.getAccount(accountId);
  }

  async updateProfile(input: {
    accountId: string;
    displayName?: string;
    locale?: "uz" | "ru" | "en";
    notificationsEnabled?: boolean;
    securityAlertsEnabled?: boolean;
    now: string;
  }): Promise<AccountRecord> {
    if (input.displayName !== undefined) {
      await runD1Operation(
        () =>
          this.database
            .prepare("UPDATE accounts SET display_name = ?1, updated_at = ?2 WHERE id = ?3")
            .bind(input.displayName, input.now, input.accountId)
            .run(),
        this.policy,
      );
    }
    await runD1Operation(
      () =>
        this.database
          .prepare(
            `UPDATE account_settings SET
              locale = COALESCE(?1, locale),
              notifications_enabled = COALESCE(?2, notifications_enabled),
              security_alerts_enabled = COALESCE(?3, security_alerts_enabled),
              updated_at = ?4
            WHERE account_id = ?5`,
          )
          .bind(
            input.locale ?? null,
            input.notificationsEnabled === undefined ? null : Number(input.notificationsEnabled),
            input.securityAlertsEnabled === undefined ? null : Number(input.securityAlertsEnabled),
            input.now,
            input.accountId,
          )
          .run(),
      this.policy,
    );
    return this.getAccount(input.accountId);
  }

  async recordConsent(input: {
    accountId: string;
    type: "terms" | "privacy" | "marketing";
    version: string;
    granted: boolean;
    now: string;
  }): Promise<void> {
    await runD1Operation(
      () =>
        this.database
          .prepare(
            `INSERT INTO account_consents (id, account_id, consent_type, document_version, granted, recorded_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(account_id, consent_type, document_version) DO UPDATE SET granted = excluded.granted, recorded_at = excluded.recorded_at`,
          )
          .bind(
            crypto.randomUUID(),
            input.accountId,
            input.type,
            input.version,
            Number(input.granted),
            input.now,
          )
          .run(),
      this.policy,
    );
  }

  async listConsents(accountId: string): Promise<unknown[]> {
    const result = await runD1Operation(
      () =>
        this.database
          .prepare(
            "SELECT consent_type AS type, document_version AS version, granted, recorded_at AS recordedAt FROM account_consents WHERE account_id = ?1 ORDER BY recorded_at DESC",
          )
          .bind(accountId)
          .all(),
      this.policy,
    );
    return result.results;
  }

  async createSession(input: {
    accountId: string;
    tokenHash: string;
    csrfHash: string | null;
    platform: SessionPlatform;
    deviceId?: string;
    deviceName?: string;
    userAgentHash?: string;
    ipHash?: string;
    expiresAt: string;
    now: string;
  }): Promise<string> {
    const id = crypto.randomUUID();
    await runD1Operation(
      () =>
        this.database
          .prepare(
            `INSERT INTO auth_sessions (
              id, account_id, token_hash, csrf_hash, platform, device_id, device_name,
              user_agent_hash, ip_hash, created_at, last_seen_at, expires_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10, ?11)`,
          )
          .bind(
            id,
            input.accountId,
            input.tokenHash,
            input.csrfHash,
            input.platform,
            input.deviceId ?? null,
            input.deviceName ?? null,
            input.userAgentHash ?? null,
            input.ipHash ?? null,
            input.now,
            input.expiresAt,
          )
          .run(),
      this.policy,
    );
    return id;
  }

  async findSessionByTokenHash(tokenHash: string, now: string): Promise<SessionRecord | null> {
    const row = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT s.id, s.account_id, s.token_hash, s.csrf_hash, s.platform, s.device_id,
              s.device_name, s.admin_verified_at, s.created_at, s.last_seen_at, s.expires_at,
              a.status AS account_status, COALESCE(group_concat(r.role), 'user') AS roles
            FROM auth_sessions s
            JOIN accounts a ON a.id = s.account_id
            LEFT JOIN account_roles r ON r.account_id = a.id
            WHERE s.token_hash = ?1 AND s.revoked_at IS NULL AND s.expires_at > ?2
            GROUP BY s.id`,
          )
          .bind(tokenHash, now)
          .first<{
            id: string;
            account_id: string;
            token_hash: string;
            csrf_hash: string | null;
            platform: SessionPlatform;
            device_id: string | null;
            device_name: string | null;
            admin_verified_at: string | null;
            created_at: string;
            last_seen_at: string;
            expires_at: string;
            account_status: AccountStatus;
            roles: string;
          }>(),
      this.policy,
    );
    if (row === null) return null;
    return {
      id: row.id,
      accountId: row.account_id,
      tokenHash: row.token_hash,
      csrfHash: row.csrf_hash,
      platform: row.platform,
      deviceId: row.device_id,
      deviceName: row.device_name,
      adminVerifiedAt: row.admin_verified_at,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      expiresAt: row.expires_at,
      roles: row.roles.split(","),
      accountStatus: row.account_status,
    };
  }

  async touchSession(sessionId: string, lastSeenAt: string, expiresAt?: string): Promise<void> {
    await runD1Operation(
      () =>
        this.database
          .prepare(
            "UPDATE auth_sessions SET last_seen_at = ?1, expires_at = COALESCE(?2, expires_at) WHERE id = ?3 AND revoked_at IS NULL",
          )
          .bind(lastSeenAt, expiresAt ?? null, sessionId)
          .run(),
      this.policy,
    );
  }

  async listSessions(accountId: string): Promise<unknown[]> {
    const result = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT id, platform, device_id AS deviceId, device_name AS deviceName,
              created_at AS createdAt, last_seen_at AS lastSeenAt, expires_at AS expiresAt,
              admin_verified_at AS adminVerifiedAt
            FROM auth_sessions WHERE account_id = ?1 AND revoked_at IS NULL AND expires_at > ?2
            ORDER BY last_seen_at DESC`,
          )
          .bind(accountId, new Date().toISOString())
          .all(),
      this.policy,
    );
    return result.results;
  }

  async revokeSession(
    sessionId: string,
    accountId: string,
    reason: string,
    now: string,
  ): Promise<boolean> {
    const result = await runD1Operation(
      () =>
        this.database
          .prepare(
            "UPDATE auth_sessions SET revoked_at = ?1, revoke_reason = ?2 WHERE id = ?3 AND account_id = ?4 AND revoked_at IS NULL",
          )
          .bind(now, reason, sessionId, accountId)
          .run(),
      this.policy,
    );
    return result.meta.changes > 0;
  }

  async revokeAllSessions(accountId: string, reason: string, now: string): Promise<void> {
    await runD1Operation(
      () =>
        this.database
          .prepare(
            "UPDATE auth_sessions SET revoked_at = ?1, revoke_reason = ?2 WHERE account_id = ?3 AND revoked_at IS NULL",
          )
          .bind(now, reason, accountId)
          .run(),
      this.policy,
    );
  }

  async createChallenge(input: {
    type: "oidc_login" | "telegram_recovery" | "totp_setup" | "account_deletion";
    tokenHash: string;
    accountId?: string;
    secretCiphertext?: string;
    expiresAt: string;
  }): Promise<string> {
    const id = crypto.randomUUID();
    await runD1Operation(
      () =>
        this.database
          .prepare(
            "INSERT INTO auth_challenges (id, challenge_type, token_hash, account_id, secret_ciphertext, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
          )
          .bind(
            id,
            input.type,
            input.tokenHash,
            input.accountId ?? null,
            input.secretCiphertext ?? null,
            input.expiresAt,
          )
          .run(),
      this.policy,
    );
    return id;
  }

  async consumeChallenge(input: {
    type: "oidc_login" | "telegram_recovery" | "totp_setup" | "account_deletion";
    tokenHash: string;
    now: string;
  }): Promise<{ id: string; accountId: string | null; secretCiphertext: string | null }> {
    const row = await runD1Operation(
      () =>
        this.database
          .prepare(
            `UPDATE auth_challenges SET consumed_at = ?1
             WHERE token_hash = ?2 AND challenge_type = ?3 AND consumed_at IS NULL AND expires_at > ?1
             RETURNING id, account_id, secret_ciphertext`,
          )
          .bind(input.now, input.tokenHash, input.type)
          .first<{ id: string; account_id: string | null; secret_ciphertext: string | null }>(),
      this.policy,
    );
    if (row === null) throw new AppError("UNAUTHORIZED", "Challenge is invalid or expired");
    return { id: row.id, accountId: row.account_id, secretCiphertext: row.secret_ciphertext };
  }

  async checkRateLimit(input: {
    keyHash: string;
    scope: string;
    nowSeconds: number;
    windowSeconds: number;
    maximum: number;
  }): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const windowStart = Math.floor(input.nowSeconds / input.windowSeconds) * input.windowSeconds;
    const expiresAt = windowStart + input.windowSeconds * 2;
    const row = await runD1Operation(
      () =>
        this.database
          .prepare(
            `INSERT INTO auth_rate_limits (key_hash, scope, window_start, request_count, expires_at)
             VALUES (?1, ?2, ?3, 1, ?4)
             ON CONFLICT(key_hash, scope, window_start) DO UPDATE SET request_count = request_count + 1
             RETURNING request_count`,
          )
          .bind(input.keyHash, input.scope, windowStart, expiresAt)
          .first<{ request_count: number }>(),
      this.policy,
    );
    const count = row?.request_count ?? input.maximum + 1;
    return {
      allowed: count <= input.maximum,
      retryAfterSeconds: Math.max(1, windowStart + input.windowSeconds - input.nowSeconds),
    };
  }

  async recordSecurityEvent(input: {
    accountId?: string;
    sessionId?: string;
    eventType: string;
    severity?: "info" | "warning" | "critical";
    requestId: string;
    metadata?: Record<string, string | number | boolean>;
  }): Promise<void> {
    await runD1Operation(
      () =>
        this.database
          .prepare(
            `INSERT INTO security_events (id, account_id, session_id, event_type, severity, request_id, metadata_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
          )
          .bind(
            crypto.randomUUID(),
            input.accountId ?? null,
            input.sessionId ?? null,
            input.eventType,
            input.severity ?? "info",
            input.requestId,
            JSON.stringify(input.metadata ?? {}),
          )
          .run(),
      this.policy,
    );
  }

  async listSecurityEvents(accountId: string): Promise<unknown[]> {
    const result = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT id, event_type AS eventType, severity, metadata_json AS metadataJson,
              created_at AS createdAt FROM security_events
             WHERE account_id = ?1 ORDER BY created_at DESC LIMIT 100`,
          )
          .bind(accountId)
          .all(),
      this.policy,
    );
    return result.results.map((row) => {
      const value = row as { metadataJson?: unknown };
      const metadata: unknown =
        typeof value.metadataJson === "string" ? JSON.parse(value.metadataJson) : {};
      return {
        ...row,
        metadata,
        metadataJson: undefined,
      };
    });
  }

  async getTotpCredential(accountId: string): Promise<{
    secretCiphertext: string;
    confirmedAt: string | null;
    lastUsedStep: number | null;
  } | null> {
    const row = await runD1Operation(
      () =>
        this.database
          .prepare(
            "SELECT secret_ciphertext, confirmed_at, last_used_step FROM admin_totp_credentials WHERE account_id = ?1",
          )
          .bind(accountId)
          .first<{
            secret_ciphertext: string;
            confirmed_at: string | null;
            last_used_step: number | null;
          }>(),
      this.policy,
    );
    return row === null
      ? null
      : {
          secretCiphertext: row.secret_ciphertext,
          confirmedAt: row.confirmed_at,
          lastUsedStep: row.last_used_step,
        };
  }

  async saveTotpCredential(
    accountId: string,
    secretCiphertext: string,
    now: string,
  ): Promise<void> {
    await runD1Operation(
      () =>
        this.database
          .prepare(
            `INSERT INTO admin_totp_credentials (account_id, secret_ciphertext, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?3)
             ON CONFLICT(account_id) DO UPDATE SET secret_ciphertext = excluded.secret_ciphertext,
               confirmed_at = NULL, last_used_step = NULL, updated_at = excluded.updated_at`,
          )
          .bind(accountId, secretCiphertext, now)
          .run(),
      this.policy,
    );
  }

  async confirmTotp(accountId: string, step: number, now: string): Promise<void> {
    await runD1Operation(
      () =>
        this.database
          .prepare(
            "UPDATE admin_totp_credentials SET confirmed_at = COALESCE(confirmed_at, ?1), last_used_step = ?2, updated_at = ?1 WHERE account_id = ?3",
          )
          .bind(now, step, accountId)
          .run(),
      this.policy,
    );
  }

  async markAdminSessionVerified(sessionId: string, now: string): Promise<void> {
    await runD1Operation(
      () =>
        this.database
          .prepare("UPDATE auth_sessions SET admin_verified_at = ?1 WHERE id = ?2")
          .bind(now, sessionId)
          .run(),
      this.policy,
    );
  }

  async createPrivacyRequest(input: {
    accountId: string;
    type: "export" | "deletion";
    status: "pending" | "blocked_storage";
  }): Promise<string> {
    const id = crypto.randomUUID();
    await runD1Operation(
      () =>
        this.database
          .prepare(
            "INSERT INTO privacy_requests (id, account_id, request_type, status) VALUES (?1, ?2, ?3, ?4)",
          )
          .bind(id, input.accountId, input.type, input.status)
          .run(),
      this.policy,
    );
    return id;
  }

  async markDeletionPending(accountId: string, now: string): Promise<void> {
    await runD1Operation(
      () =>
        this.database.batch([
          this.database
            .prepare(
              "UPDATE accounts SET status = 'deletion_pending', updated_at = ?1 WHERE id = ?2",
            )
            .bind(now, accountId),
          this.database
            .prepare(
              "UPDATE auth_sessions SET revoked_at = ?1, revoke_reason = 'account_deletion' WHERE account_id = ?2 AND revoked_at IS NULL",
            )
            .bind(now, accountId),
        ]),
      this.policy,
    );
  }

  async getFinancialIntegrationContext(accountId: string): Promise<{
    accountId: string;
    status: AccountStatus;
    eligibleForLedger: boolean;
  }> {
    const account = await this.getAccount(accountId);
    return {
      accountId: account.id,
      status: account.status,
      eligibleForLedger: account.status === "active",
    };
  }
}
