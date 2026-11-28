import type { ProviderName, YuristimModel } from "@yuristim/ai";
import { AppError } from "@yuristim/errors";
import { runD1Operation, type D1ExecutionPolicy } from "./execution";

export type AIModelConfiguration = {
  modelName: YuristimModel;
  provider: ProviderName;
  providerModelId: string;
  priceKey: string;
  enabled: boolean;
  streamingEnabled: boolean;
  maxOutputTokens: number;
  configVersion: number;
};

export type AIPromptVersion = {
  id: string;
  promptKey: string;
  version: number;
  content: string;
};

type ConversationRow = {
  id: string;
  accountId: string;
  title: string;
  modelName: YuristimModel;
  status: "active" | "archived" | "deleted";
  temporary: number;
  memoryEnabled: number;
  createdAt: string;
  updatedAt: string;
  deleteAfter: string | null;
};

type Conversation = Omit<ConversationRow, "temporary" | "memoryEnabled"> & {
  temporary: boolean;
  memoryEnabled: boolean;
};

export class D1AIRepository {
  constructor(
    private readonly database: D1Database,
    private readonly policy: D1ExecutionPolicy,
  ) {}

  async modelConfiguration(modelName: YuristimModel): Promise<AIModelConfiguration> {
    const row = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT model_name AS modelName, provider, provider_model_id AS providerModelId,
              price_key AS priceKey, enabled, streaming_enabled AS streamingEnabled,
              max_output_tokens AS maxOutputTokens, config_version AS configVersion
             FROM ai_model_registry WHERE model_name = ?1`,
          )
          .bind(modelName)
          .first<
            Omit<AIModelConfiguration, "enabled" | "streamingEnabled"> & {
              enabled: number;
              streamingEnabled: number;
            }
          >(),
      this.policy,
    );
    if (row === null)
      throw new AppError("SERVICE_UNAVAILABLE", `${modelName} model is unavailable`);
    return { ...row, enabled: row.enabled === 1, streamingEnabled: row.streamingEnabled === 1 };
  }

  async listModels(): Promise<AIModelConfiguration[]> {
    const rows = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT model_name AS modelName, provider, provider_model_id AS providerModelId,
              price_key AS priceKey, enabled, streaming_enabled AS streamingEnabled,
              max_output_tokens AS maxOutputTokens, config_version AS configVersion
             FROM ai_model_registry ORDER BY model_name`,
          )
          .all<
            Omit<AIModelConfiguration, "enabled" | "streamingEnabled"> & {
              enabled: number;
              streamingEnabled: number;
            }
          >(),
      this.policy,
    );
    return rows.results.map((row) => ({
      ...row,
      enabled: row.enabled === 1,
      streamingEnabled: row.streamingEnabled === 1,
    }));
  }

  async activePrompt(modelName: YuristimModel): Promise<AIPromptVersion> {
    const row = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT id, prompt_key AS promptKey, version, content
             FROM ai_prompt_versions WHERE model_name = ?1 AND status = 'active'`,
          )
          .bind(modelName)
          .first<AIPromptVersion>(),
      this.policy,
    );
    if (row === null) throw new AppError("SERVICE_UNAVAILABLE", "Active AI prompt is unavailable");
    return row;
  }

  async createConversation(input: {
    accountId: string;
    title: string;
    modelName: YuristimModel;
    temporary: boolean;
    memoryEnabled: boolean;
    now: string;
  }): Promise<Conversation> {
    const id = crypto.randomUUID();
    const deleteAfter = input.temporary
      ? new Date(new Date(input.now).getTime() + 24 * 60 * 60 * 1_000).toISOString()
      : null;
    await runD1Operation(
      () =>
        this.database
          .prepare(
            `INSERT INTO ai_conversations (
              id, account_id, title, model_name, temporary, memory_enabled,
              created_at, updated_at, delete_after
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8)`,
          )
          .bind(
            id,
            input.accountId,
            input.title,
            input.modelName,
            input.temporary ? 1 : 0,
            input.memoryEnabled ? 1 : 0,
            input.now,
            deleteAfter,
          )
          .run(),
      this.policy,
    );
    return this.conversation(input.accountId, id);
  }

  private normalizeConversation(row: ConversationRow): Conversation {
    return { ...row, temporary: row.temporary === 1, memoryEnabled: row.memoryEnabled === 1 };
  }

  async conversation(accountId: string, id: string) {
    const row = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT id, account_id AS accountId, title, model_name AS modelName, status,
              temporary, memory_enabled AS memoryEnabled, created_at AS createdAt,
              updated_at AS updatedAt, delete_after AS deleteAfter
             FROM ai_conversations
             WHERE id = ?1 AND account_id = ?2 AND status <> 'deleted'`,
          )
          .bind(id, accountId)
          .first<ConversationRow>(),
      this.policy,
    );
    if (row === null) throw new AppError("NOT_FOUND", "Conversation not found");
    return this.normalizeConversation(row);
  }

  async listConversations(accountId: string, query: string | undefined, limit: number) {
    const search =
      query === undefined ? null : `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    const rows = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT id, account_id AS accountId, title, model_name AS modelName, status,
              temporary, memory_enabled AS memoryEnabled, created_at AS createdAt,
              updated_at AS updatedAt, delete_after AS deleteAfter
             FROM ai_conversations
             WHERE account_id = ?1 AND status <> 'deleted'
               AND (?2 IS NULL OR title LIKE ?2 ESCAPE '\\')
             ORDER BY updated_at DESC LIMIT ?3`,
          )
          .bind(accountId, search, limit)
          .all<ConversationRow>(),
      this.policy,
    );
    return rows.results.map((row) => this.normalizeConversation(row));
  }

  async updateConversation(input: {
    accountId: string;
    id: string;
    title?: string;
    status?: "active" | "archived";
    memoryEnabled?: boolean;
    now: string;
  }) {
    await this.conversation(input.accountId, input.id);
    await runD1Operation(
      () =>
        this.database
          .prepare(
            `UPDATE ai_conversations SET
              title = COALESCE(?1, title), status = COALESCE(?2, status),
              memory_enabled = COALESCE(?3, memory_enabled), updated_at = ?4
             WHERE id = ?5 AND account_id = ?6 AND status <> 'deleted'`,
          )
          .bind(
            input.title ?? null,
            input.status ?? null,
            input.memoryEnabled === undefined ? null : input.memoryEnabled ? 1 : 0,
            input.now,
            input.id,
            input.accountId,
          )
          .run(),
      this.policy,
    );
    return this.conversation(input.accountId, input.id);
  }

  async deleteConversation(accountId: string, id: string, now: string): Promise<void> {
    await this.conversation(accountId, id);
    await runD1Operation(
      () =>
        this.database
          .prepare(
            `UPDATE ai_conversations SET status = 'deleted', updated_at = ?1
             WHERE id = ?2 AND account_id = ?3`,
          )
          .bind(now, id, accountId)
          .run(),
      this.policy,
    );
  }

  async messages(accountId: string, conversationId: string, limit = 50) {
    await this.conversation(accountId, conversationId);
    const rows = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT id, role, content, status, parent_message_id AS parentMessageId,
              edited_from_message_id AS editedFromMessageId,
              verification_status AS verificationStatus, created_at AS createdAt
             FROM ai_messages
             WHERE account_id = ?1 AND conversation_id = ?2 AND status <> 'deleted'
             ORDER BY created_at DESC LIMIT ?3`,
          )
          .bind(accountId, conversationId, limit)
          .all(),
      this.policy,
    );
    return rows.results.reverse();
  }

  async message(accountId: string, conversationId: string, messageId: string) {
    const row = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT id, role, content, status, parent_message_id AS parentMessageId,
              verification_status AS verificationStatus, created_at AS createdAt
             FROM ai_messages
             WHERE id = ?1 AND conversation_id = ?2 AND account_id = ?3 AND status <> 'deleted'`,
          )
          .bind(messageId, conversationId, accountId)
          .first<{ id: string; role: "user" | "assistant"; content: string; status: string }>(),
      this.policy,
    );
    if (row === null) throw new AppError("NOT_FOUND", "Message not found");
    return row;
  }

  async editUserMessage(input: {
    accountId: string;
    conversationId: string;
    messageId: string;
    content: string;
    contentHash: string;
    now: string;
  }) {
    const original = await this.message(input.accountId, input.conversationId, input.messageId);
    if (original.role !== "user")
      throw new AppError("FORBIDDEN", "Only user messages can be edited");
    const id = crypto.randomUUID();
    await runD1Operation(
      () =>
        this.database.batch([
          this.database
            .prepare(
              "UPDATE ai_messages SET status = 'deleted', deleted_at = ?1 WHERE id = ?2 AND account_id = ?3",
            )
            .bind(input.now, input.messageId, input.accountId),
          this.database
            .prepare(
              `INSERT INTO ai_messages (
                id, conversation_id, account_id, role, content, content_hash,
                status, edited_from_message_id, created_at
              ) VALUES (?1, ?2, ?3, 'user', ?4, ?5, 'completed', ?6, ?7)`,
            )
            .bind(
              id,
              input.conversationId,
              input.accountId,
              input.content,
              input.contentHash,
              input.messageId,
              input.now,
            ),
          this.database
            .prepare(
              "UPDATE ai_conversations SET updated_at = ?1 WHERE id = ?2 AND account_id = ?3",
            )
            .bind(input.now, input.conversationId, input.accountId),
        ]),
      this.policy,
    );
    return {
      id,
      editedFromMessageId: input.messageId,
      content: input.content,
      createdAt: input.now,
    };
  }

  async createRequest(input: {
    accountId: string;
    conversationId: string;
    model: AIModelConfiguration;
    prompt: AIPromptVersion;
    content: string;
    contentHash: string;
    idempotencyKey: string;
    requestHash: string;
    reservationId: string;
    now: string;
  }): Promise<{ runId: string; messageId: string; created: boolean; status: string }> {
    const existing = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT id AS runId, request_message_id AS messageId, request_hash AS requestHash, status
             FROM ai_runs WHERE account_id = ?1 AND idempotency_key = ?2`,
          )
          .bind(input.accountId, input.idempotencyKey)
          .first<{ runId: string; messageId: string; requestHash: string; status: string }>(),
      this.policy,
    );
    if (existing !== null) {
      if (existing.requestHash !== input.requestHash) {
        throw new AppError("CONFLICT", "Idempotency key was already used with another request");
      }
      return {
        runId: existing.runId,
        messageId: existing.messageId,
        created: false,
        status: existing.status,
      };
    }
    await this.conversation(input.accountId, input.conversationId);
    const runId = crypto.randomUUID();
    const messageId = crypto.randomUUID();
    await runD1Operation(
      () =>
        this.database.batch([
          this.database
            .prepare(
              `INSERT INTO ai_messages (
                id, conversation_id, account_id, role, content, content_hash, status, created_at
              ) VALUES (?1, ?2, ?3, 'user', ?4, ?5, 'completed', ?6)`,
            )
            .bind(
              messageId,
              input.conversationId,
              input.accountId,
              input.content,
              input.contentHash,
              input.now,
            ),
          this.database
            .prepare(
              `INSERT INTO ai_runs (
                id, account_id, conversation_id, request_message_id, model_name, provider,
                provider_model_id, prompt_version_id, idempotency_key, request_hash,
                reservation_id, status, created_at
              ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'reserved', ?12)`,
            )
            .bind(
              runId,
              input.accountId,
              input.conversationId,
              messageId,
              input.model.modelName,
              input.model.provider,
              input.model.providerModelId,
              input.prompt.id,
              input.idempotencyKey,
              input.requestHash,
              input.reservationId,
              input.now,
            ),
          this.database
            .prepare("UPDATE ai_conversations SET updated_at = ?1 WHERE id = ?2")
            .bind(input.now, input.conversationId),
        ]),
      this.policy,
    );
    return { runId, messageId, created: true, status: "reserved" };
  }

  async markRunRunning(accountId: string, runId: string): Promise<void> {
    await runD1Operation(
      () =>
        this.database
          .prepare(
            "UPDATE ai_runs SET status = 'running' WHERE id = ?1 AND account_id = ?2 AND status = 'reserved'",
          )
          .bind(runId, accountId)
          .run(),
      this.policy,
    );
  }

  async completeRun(input: {
    accountId: string;
    runId: string;
    conversationId: string;
    parentMessageId: string;
    content: string;
    contentHash: string;
    providerResponseId: string | null;
    inputUnits: number;
    outputUnits: number;
    chargedMicrocredits: number;
    now: string;
  }): Promise<string> {
    const messageId = crypto.randomUUID();
    await runD1Operation(
      () =>
        this.database.batch([
          this.database
            .prepare(
              `INSERT INTO ai_messages (
                id, conversation_id, account_id, role, content, content_hash, status,
                parent_message_id, provider_response_id, verification_status, created_at
              ) VALUES (?1, ?2, ?3, 'assistant', ?4, ?5, 'completed', ?6, ?7, 'unverified', ?8)`,
            )
            .bind(
              messageId,
              input.conversationId,
              input.accountId,
              input.content,
              input.contentHash,
              input.parentMessageId,
              input.providerResponseId,
              input.now,
            ),
          this.database
            .prepare(
              `UPDATE ai_runs SET response_message_id = ?1, status = 'completed', input_units = ?2,
                output_units = ?3, completed_at = ?4
               WHERE id = ?5 AND account_id = ?6 AND status = 'running'`,
            )
            .bind(
              messageId,
              input.inputUnits,
              input.outputUnits,
              input.now,
              input.runId,
              input.accountId,
            ),
          this.database
            .prepare(
              `INSERT INTO ai_usage_events (
                id, ai_run_id, account_id, provider, model_name, input_units,
                output_units, charged_microcredits, created_at
              ) SELECT ?1, id, account_id, provider, model_name, ?2, ?3, ?4, ?5
                FROM ai_runs WHERE id = ?6 AND account_id = ?7`,
            )
            .bind(
              crypto.randomUUID(),
              input.inputUnits,
              input.outputUnits,
              input.chargedMicrocredits,
              input.now,
              input.runId,
              input.accountId,
            ),
          this.database
            .prepare(
              "UPDATE ai_conversations SET updated_at = ?1 WHERE id = ?2 AND account_id = ?3",
            )
            .bind(input.now, input.conversationId, input.accountId),
        ]),
      this.policy,
    );
    return messageId;
  }

  async failRun(input: {
    accountId: string;
    runId: string;
    status: "failed" | "cancelled" | "reconciliation_required";
    errorCategory: string;
    now: string;
  }): Promise<void> {
    await runD1Operation(
      () =>
        this.database
          .prepare(
            `UPDATE ai_runs SET status = ?1, error_category = ?2, completed_at = ?3
             WHERE id = ?4 AND account_id = ?5 AND status IN ('reserved', 'running')`,
          )
          .bind(input.status, input.errorCategory, input.now, input.runId, input.accountId)
          .run(),
      this.policy,
    );
  }

  async requestCancellation(accountId: string, runId: string, now: string): Promise<void> {
    const result = await runD1Operation(
      () =>
        this.database
          .prepare(
            `UPDATE ai_runs SET cancellation_requested_at = ?1
             WHERE id = ?2 AND account_id = ?3 AND status IN ('reserved', 'running')`,
          )
          .bind(now, runId, accountId)
          .run(),
      this.policy,
    );
    if (result.meta.changes === 0) throw new AppError("NOT_FOUND", "Active AI run not found");
  }

  async isCancellationRequested(accountId: string, runId: string): Promise<boolean> {
    const row = await runD1Operation(
      () =>
        this.database
          .prepare(
            "SELECT cancellation_requested_at AS requestedAt FROM ai_runs WHERE id = ?1 AND account_id = ?2",
          )
          .bind(runId, accountId)
          .first<{ requestedAt: string | null }>(),
      this.policy,
    );
    return row?.requestedAt !== null && row?.requestedAt !== undefined;
  }

  async addMemory(input: {
    accountId: string;
    scope: "global" | "conversation" | "professional_task";
    conversationId?: string;
    content: string;
    contentHash: string;
    consentVersion: string;
    now: string;
  }) {
    if (input.conversationId !== undefined)
      await this.conversation(input.accountId, input.conversationId);
    const id = crypto.randomUUID();
    await runD1Operation(
      () =>
        this.database
          .prepare(
            `INSERT INTO ai_memories (
              id, account_id, scope, conversation_id, content, content_hash, consent_version, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
          )
          .bind(
            id,
            input.accountId,
            input.scope,
            input.conversationId ?? null,
            input.content,
            input.contentHash,
            input.consentVersion,
            input.now,
          )
          .run(),
      this.policy,
    );
    return { id, scope: input.scope, createdAt: input.now };
  }

  async listMemories(accountId: string) {
    const rows = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT id, scope, conversation_id AS conversationId, content,
              consent_version AS consentVersion, created_at AS createdAt
             FROM ai_memories WHERE account_id = ?1 AND status = 'active'
             ORDER BY created_at DESC LIMIT 100`,
          )
          .bind(accountId)
          .all(),
      this.policy,
    );
    return rows.results;
  }

  async deleteMemory(accountId: string, id: string, now: string): Promise<void> {
    const result = await runD1Operation(
      () =>
        this.database
          .prepare(
            `UPDATE ai_memories SET status = 'deleted', deleted_at = ?1
             WHERE id = ?2 AND account_id = ?3 AND status = 'active'`,
          )
          .bind(now, id, accountId)
          .run(),
      this.policy,
    );
    if (result.meta.changes === 0) throw new AppError("NOT_FOUND", "Memory not found");
  }

  async createGeneratedDocument(input: {
    accountId: string;
    conversationId?: string;
    title: string;
    content: string;
    contentHash: string;
    now: string;
  }) {
    if (input.conversationId !== undefined)
      await this.conversation(input.accountId, input.conversationId);
    const documentId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    await runD1Operation(
      () =>
        this.database.batch([
          this.database
            .prepare(
              `INSERT INTO ai_documents (
                id, account_id, conversation_id, file_name, media_type, size_bytes, status, created_at
              ) VALUES (?1, ?2, ?3, ?4, 'text/plain', ?5, 'blocked_storage', ?6)`,
            )
            .bind(
              documentId,
              input.accountId,
              input.conversationId ?? null,
              input.title,
              new TextEncoder().encode(input.content).byteLength,
              input.now,
            ),
          this.database
            .prepare(
              `INSERT INTO ai_document_versions (
                id, document_id, account_id, version, content, content_hash, created_at
              ) VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6)`,
            )
            .bind(
              versionId,
              documentId,
              input.accountId,
              input.content,
              input.contentHash,
              input.now,
            ),
        ]),
      this.policy,
    );
    return {
      id: documentId,
      versionId,
      version: 1,
      status: "blocked_storage" as const,
      export: "disabled_r2_unavailable" as const,
    };
  }

  async updateModel(input: {
    modelName: YuristimModel;
    providerModelId: string;
    enabled: boolean;
    streamingEnabled: boolean;
    maxOutputTokens: number;
    actorAccountId: string;
    now: string;
  }): Promise<AIModelConfiguration> {
    await runD1Operation(
      () =>
        this.database
          .prepare(
            `UPDATE ai_model_registry SET provider_model_id = ?1, enabled = ?2,
              streaming_enabled = ?3, max_output_tokens = ?4,
              config_version = config_version + 1, updated_by_account_id = ?5, updated_at = ?6
             WHERE model_name = ?7`,
          )
          .bind(
            input.providerModelId,
            input.enabled ? 1 : 0,
            input.streamingEnabled ? 1 : 0,
            input.maxOutputTokens,
            input.actorAccountId,
            input.now,
            input.modelName,
          )
          .run(),
      this.policy,
    );
    return this.modelConfiguration(input.modelName);
  }

  async createPrompt(input: {
    promptKey: string;
    version: number;
    modelName: YuristimModel;
    content: string;
    contentHash: string;
    actorAccountId: string;
    activate: boolean;
    now: string;
  }) {
    const id = crypto.randomUUID();
    const statements: D1PreparedStatement[] = [];
    if (input.activate) {
      statements.push(
        this.database
          .prepare(
            "UPDATE ai_prompt_versions SET status = 'retired' WHERE prompt_key = ?1 AND status = 'active'",
          )
          .bind(input.promptKey),
      );
    }
    statements.push(
      this.database
        .prepare(
          `INSERT INTO ai_prompt_versions (
            id, prompt_key, version, model_name, content, content_hash, status,
            created_by_account_id, created_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
        )
        .bind(
          id,
          input.promptKey,
          input.version,
          input.modelName,
          input.content,
          input.contentHash,
          input.activate ? "active" : "draft",
          input.actorAccountId,
          input.now,
        ),
    );
    await runD1Operation(() => this.database.batch(statements), this.policy);
    return { id, status: input.activate ? "active" : "draft" };
  }

  async usageSummary() {
    const rows = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT provider, model_name AS modelName, count(*) AS runCount,
              sum(input_units) AS inputUnits, sum(output_units) AS outputUnits,
              sum(COALESCE(charged_microcredits, 0)) AS chargedMicrocredits
             FROM ai_usage_events GROUP BY provider, model_name ORDER BY model_name`,
          )
          .all(),
      this.policy,
    );
    return rows.results;
  }

  async expireTemporaryConversations(now: string): Promise<number> {
    const due = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT id FROM ai_conversations
             WHERE temporary = 1 AND status <> 'deleted' AND delete_after IS NOT NULL AND delete_after <= ?1
             LIMIT 100`,
          )
          .bind(now)
          .all<{ id: string }>(),
      this.policy,
    );
    if (due.results.length === 0) return 0;
    const ids = due.results.map((row) => row.id);
    for (const id of ids) {
      await runD1Operation(
        () =>
          this.database.batch([
            this.database
              .prepare(
                `UPDATE ai_messages SET content = '[expired temporary conversation]',
                  content_hash = 'e90e7f76167f5472f973c7155dd91f6221296b8044afc700b4f8e77263b8ab2b',
                  status = 'deleted', deleted_at = ?1
                 WHERE conversation_id = ?2 AND status <> 'deleted'`,
              )
              .bind(now, id),
            this.database
              .prepare(
                "UPDATE ai_conversations SET status = 'deleted', updated_at = ?1 WHERE id = ?2",
              )
              .bind(now, id),
          ]),
        this.policy,
      );
    }
    return ids.length;
  }
}
