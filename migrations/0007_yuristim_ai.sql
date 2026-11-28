PRAGMA foreign_keys = ON;

CREATE TABLE ai_model_registry (
  model_name TEXT PRIMARY KEY NOT NULL CHECK (model_name IN ('Lite', 'Pro')),
  provider TEXT NOT NULL CHECK (provider IN ('google', 'openai')),
  provider_model_id TEXT NOT NULL CHECK (length(provider_model_id) BETWEEN 3 AND 128),
  price_key TEXT NOT NULL CHECK (length(price_key) BETWEEN 1 AND 96),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  streaming_enabled INTEGER NOT NULL DEFAULT 1 CHECK (streaming_enabled IN (0, 1)),
  max_output_tokens INTEGER NOT NULL CHECK (max_output_tokens BETWEEN 1 AND 32768),
  config_version INTEGER NOT NULL DEFAULT 1 CHECK (config_version > 0),
  updated_by_account_id TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (updated_by_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE ai_prompt_versions (
  id TEXT PRIMARY KEY NOT NULL,
  prompt_key TEXT NOT NULL CHECK (length(prompt_key) BETWEEN 1 AND 64),
  version INTEGER NOT NULL CHECK (version > 0),
  model_name TEXT NOT NULL CHECK (model_name IN ('Lite', 'Pro')),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 32 AND 20000),
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'retired')),
  created_by_account_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (prompt_key, version),
  FOREIGN KEY (created_by_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) STRICT;

CREATE UNIQUE INDEX idx_ai_prompt_one_active
ON ai_prompt_versions(prompt_key) WHERE status = 'active';

CREATE TABLE ai_conversations (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Yangi suhbat' CHECK (length(title) BETWEEN 1 AND 120),
  model_name TEXT NOT NULL CHECK (model_name IN ('Lite', 'Pro')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  temporary INTEGER NOT NULL DEFAULT 0 CHECK (temporary IN (0, 1)),
  memory_enabled INTEGER NOT NULL DEFAULT 0 CHECK (memory_enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  delete_after TEXT,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX idx_ai_conversations_account
ON ai_conversations(account_id, status, updated_at DESC);

CREATE TABLE ai_messages (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 100000),
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'deleted')),
  parent_message_id TEXT,
  edited_from_message_id TEXT,
  provider_response_id TEXT CHECK (provider_response_id IS NULL OR length(provider_response_id) <= 256),
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified', 'not_applicable')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE RESTRICT,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (parent_message_id) REFERENCES ai_messages(id) ON DELETE RESTRICT,
  FOREIGN KEY (edited_from_message_id) REFERENCES ai_messages(id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX idx_ai_messages_conversation
ON ai_messages(conversation_id, created_at);

CREATE TABLE ai_runs (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  request_message_id TEXT NOT NULL,
  response_message_id TEXT,
  model_name TEXT NOT NULL CHECK (model_name IN ('Lite', 'Pro')),
  provider TEXT NOT NULL CHECK (provider IN ('google', 'openai')),
  provider_model_id TEXT NOT NULL,
  prompt_version_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
  request_hash TEXT NOT NULL CHECK (length(request_hash) = 64),
  reservation_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'running', 'completed', 'failed', 'cancelled', 'reconciliation_required')),
  input_units INTEGER CHECK (input_units IS NULL OR input_units >= 0),
  output_units INTEGER CHECK (output_units IS NULL OR output_units >= 0),
  error_category TEXT CHECK (error_category IS NULL OR length(error_category) <= 64),
  cancellation_requested_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at TEXT,
  UNIQUE (account_id, idempotency_key),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE RESTRICT,
  FOREIGN KEY (request_message_id) REFERENCES ai_messages(id) ON DELETE RESTRICT,
  FOREIGN KEY (response_message_id) REFERENCES ai_messages(id) ON DELETE RESTRICT,
  FOREIGN KEY (prompt_version_id) REFERENCES ai_prompt_versions(id) ON DELETE RESTRICT,
  FOREIGN KEY (reservation_id) REFERENCES credit_reservations(id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX idx_ai_runs_account ON ai_runs(account_id, created_at DESC);
CREATE INDEX idx_ai_runs_status ON ai_runs(status, created_at);

CREATE TABLE ai_memories (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'conversation', 'professional_task')),
  conversation_id TEXT,
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 4000),
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  consent_version TEXT NOT NULL CHECK (length(consent_version) BETWEEN 1 AND 64),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX idx_ai_memories_account ON ai_memories(account_id, status, created_at DESC);

CREATE TABLE ai_tool_runs (
  id TEXT PRIMARY KEY NOT NULL,
  ai_run_id TEXT NOT NULL,
  tool_key TEXT NOT NULL CHECK (length(tool_key) BETWEEN 1 AND 64),
  selection_mode TEXT NOT NULL CHECK (selection_mode IN ('automatic', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('blocked', 'pending', 'running', 'completed', 'failed', 'cancelled')),
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  safe_summary TEXT CHECK (safe_summary IS NULL OR length(safe_summary) <= 256),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at TEXT,
  FOREIGN KEY (ai_run_id) REFERENCES ai_runs(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE ai_documents (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  conversation_id TEXT,
  file_name TEXT NOT NULL CHECK (length(file_name) BETWEEN 1 AND 255),
  media_type TEXT NOT NULL CHECK (media_type IN ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  storage_key TEXT,
  status TEXT NOT NULL CHECK (status IN ('blocked_storage', 'pending', 'ready', 'failed', 'deleted')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX idx_ai_documents_account ON ai_documents(account_id, created_at DESC);

CREATE TABLE ai_document_versions (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 100000),
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (document_id, version),
  FOREIGN KEY (document_id) REFERENCES ai_documents(id) ON DELETE RESTRICT,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE ai_citations (
  id TEXT PRIMARY KEY NOT NULL,
  message_id TEXT NOT NULL,
  source_uri TEXT NOT NULL CHECK (length(source_uri) BETWEEN 8 AND 2048),
  source_title TEXT NOT NULL CHECK (length(source_title) BETWEEN 1 AND 256),
  article_reference TEXT,
  verification_status TEXT NOT NULL CHECK (verification_status IN ('unverified', 'verified', 'rejected')),
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (message_id) REFERENCES ai_messages(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE ai_usage_events (
  id TEXT PRIMARY KEY NOT NULL,
  ai_run_id TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'openai')),
  model_name TEXT NOT NULL CHECK (model_name IN ('Lite', 'Pro')),
  input_units INTEGER NOT NULL CHECK (input_units >= 0),
  output_units INTEGER NOT NULL CHECK (output_units >= 0),
  direct_cost_micro_uzs INTEGER CHECK (direct_cost_micro_uzs IS NULL OR direct_cost_micro_uzs >= 0),
  charged_microcredits INTEGER CHECK (charged_microcredits IS NULL OR charged_microcredits >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (ai_run_id) REFERENCES ai_runs(id) ON DELETE RESTRICT,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) STRICT;

CREATE TRIGGER ai_usage_events_no_update
BEFORE UPDATE ON ai_usage_events
BEGIN
  SELECT RAISE(ABORT, 'ai usage events are append-only');
END;

CREATE TRIGGER ai_usage_events_no_delete
BEFORE DELETE ON ai_usage_events
BEGIN
  SELECT RAISE(ABORT, 'ai usage events are append-only');
END;

UPDATE system_settings SET value_json = '"yuristim_ai"', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE key = 'platform_status';
