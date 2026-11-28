PRAGMA foreign_keys = ON;

CREATE TABLE legal_sources (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE CHECK (length(code) BETWEEN 2 AND 32),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 160),
  base_url TEXT NOT NULL CHECK (base_url LIKE 'https://%'),
  official_domain TEXT NOT NULL UNIQUE CHECK (length(official_domain) BETWEEN 4 AND 255),
  authority_kind TEXT NOT NULL CHECK (authority_kind IN ('normative_registry', 'judicial_authority', 'official_publisher')),
  access_mode TEXT NOT NULL CHECK (access_mode IN ('manual_verified', 'rss_metadata', 'public_html')),
  terms_url TEXT CHECK (terms_url IS NULL OR terms_url LIKE 'https://%'),
  auto_sync_enabled INTEGER NOT NULL DEFAULT 0 CHECK (auto_sync_enabled IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'blocked')),
  last_checked_at TEXT,
  last_success_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE legal_documents (
  id TEXT PRIMARY KEY NOT NULL,
  source_id TEXT NOT NULL,
  external_id TEXT NOT NULL CHECK (length(external_id) BETWEEN 1 AND 128),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 500),
  document_number TEXT CHECK (document_number IS NULL OR length(document_number) <= 128),
  document_type TEXT NOT NULL CHECK (document_type IN ('constitution', 'code', 'law', 'presidential_act', 'cabinet_resolution', 'plenum_resolution', 'court_practice', 'official_guidance', 'other')),
  legal_authority TEXT NOT NULL CHECK (legal_authority IN ('normative', 'judicial_practice', 'official_guidance')),
  jurisdiction TEXT NOT NULL DEFAULT 'UZ' CHECK (length(jurisdiction) BETWEEN 2 AND 16),
  language TEXT NOT NULL DEFAULT 'uz-Latn' CHECK (language IN ('uz-Latn', 'uz-Cyrl', 'ru', 'en')),
  adopted_at TEXT,
  official_url TEXT NOT NULL CHECK (official_url LIKE 'https://%'),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'quarantined')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (source_id, external_id),
  FOREIGN KEY (source_id) REFERENCES legal_sources(id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX idx_legal_documents_type_status
ON legal_documents(document_type, legal_authority, status);

CREATE TABLE legal_document_versions (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL,
  version_label TEXT NOT NULL CHECK (length(version_label) BETWEEN 1 AND 128),
  legal_status TEXT NOT NULL CHECK (legal_status IN ('current', 'historical', 'repealed', 'future', 'quarantined')),
  effective_from TEXT,
  effective_to TEXT,
  published_at TEXT,
  verified_at TEXT,
  verification_status TEXT NOT NULL CHECK (verification_status IN ('verified', 'pending', 'rejected')),
  completeness TEXT NOT NULL CHECK (completeness IN ('full', 'partial', 'metadata_only')),
  ingestion_method TEXT NOT NULL CHECK (ingestion_method IN ('manual_verified', 'official_feed', 'official_html')),
  source_hash TEXT NOT NULL CHECK (length(source_hash) = 64),
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  source_url TEXT NOT NULL CHECK (source_url LIKE 'https://%'),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from),
  UNIQUE (document_id, version_label),
  FOREIGN KEY (document_id) REFERENCES legal_documents(id) ON DELETE RESTRICT
) STRICT;

CREATE UNIQUE INDEX idx_legal_one_current_version
ON legal_document_versions(document_id) WHERE legal_status = 'current';

CREATE INDEX idx_legal_versions_effective
ON legal_document_versions(document_id, verification_status, effective_from, effective_to);

CREATE TABLE legal_provisions (
  id TEXT PRIMARY KEY NOT NULL,
  version_id TEXT NOT NULL,
  provision_kind TEXT NOT NULL CHECK (provision_kind IN ('preamble', 'section', 'chapter', 'article', 'part', 'clause', 'paragraph', 'metadata')),
  provision_number TEXT CHECK (provision_number IS NULL OR length(provision_number) <= 64),
  heading TEXT CHECK (heading IS NULL OR length(heading) <= 500),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 100000),
  path TEXT NOT NULL CHECK (length(path) BETWEEN 1 AND 500),
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (version_id, path),
  FOREIGN KEY (version_id) REFERENCES legal_document_versions(id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX idx_legal_provisions_version_order
ON legal_provisions(version_id, ordinal);

CREATE VIRTUAL TABLE legal_provisions_fts USING fts5(
  provision_id UNINDEXED,
  version_id UNINDEXED,
  document_title,
  document_number,
  heading,
  body,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER legal_provisions_fts_insert
AFTER INSERT ON legal_provisions
BEGIN
  INSERT INTO legal_provisions_fts (
    provision_id, version_id, document_title, document_number, heading, body
  )
  SELECT NEW.id, NEW.version_id, d.title, COALESCE(d.document_number, ''),
    COALESCE(NEW.heading, ''), NEW.body
  FROM legal_document_versions v
  JOIN legal_documents d ON d.id = v.document_id
  WHERE v.id = NEW.version_id;
END;

CREATE TRIGGER legal_provisions_fts_update
AFTER UPDATE OF heading, body ON legal_provisions
BEGIN
  DELETE FROM legal_provisions_fts WHERE provision_id = OLD.id;
  INSERT INTO legal_provisions_fts (
    provision_id, version_id, document_title, document_number, heading, body
  )
  SELECT NEW.id, NEW.version_id, d.title, COALESCE(d.document_number, ''),
    COALESCE(NEW.heading, ''), NEW.body
  FROM legal_document_versions v
  JOIN legal_documents d ON d.id = v.document_id
  WHERE v.id = NEW.version_id;
END;

CREATE TRIGGER legal_provisions_fts_delete
AFTER DELETE ON legal_provisions
BEGIN
  DELETE FROM legal_provisions_fts WHERE provision_id = OLD.id;
END;

CREATE TABLE legal_relations (
  id TEXT PRIMARY KEY NOT NULL,
  source_document_id TEXT NOT NULL,
  target_document_id TEXT NOT NULL,
  relation_type TEXT NOT NULL CHECK (relation_type IN ('amends', 'repeals', 'implements', 'references', 'interprets')),
  effective_at TEXT,
  verified_at TEXT NOT NULL,
  FOREIGN KEY (source_document_id) REFERENCES legal_documents(id) ON DELETE RESTRICT,
  FOREIGN KEY (target_document_id) REFERENCES legal_documents(id) ON DELETE RESTRICT,
  UNIQUE (source_document_id, target_document_id, relation_type, effective_at)
) STRICT;

CREATE TABLE legal_ingestion_runs (
  id TEXT PRIMARY KEY NOT NULL,
  source_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('manual', 'hourly_check', 'daily_sync', 'reindex')),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'quarantined', 'skipped')),
  discovered_count INTEGER NOT NULL DEFAULT 0 CHECK (discovered_count >= 0),
  imported_count INTEGER NOT NULL DEFAULT 0 CHECK (imported_count >= 0),
  quarantined_count INTEGER NOT NULL DEFAULT 0 CHECK (quarantined_count >= 0),
  safe_error_code TEXT CHECK (safe_error_code IS NULL OR length(safe_error_code) <= 64),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (source_id) REFERENCES legal_sources(id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX idx_legal_ingestion_runs_source
ON legal_ingestion_runs(source_id, started_at DESC);

CREATE TABLE legal_change_events (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL,
  from_version_id TEXT,
  to_version_id TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'amended', 'repealed', 'future_effective', 'metadata_changed')),
  diff_summary TEXT NOT NULL CHECK (length(diff_summary) BETWEEN 1 AND 1000),
  detected_at TEXT NOT NULL,
  verified_at TEXT,
  FOREIGN KEY (document_id) REFERENCES legal_documents(id) ON DELETE RESTRICT,
  FOREIGN KEY (from_version_id) REFERENCES legal_document_versions(id) ON DELETE RESTRICT,
  FOREIGN KEY (to_version_id) REFERENCES legal_document_versions(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE legal_quarantine (
  id TEXT PRIMARY KEY NOT NULL,
  source_id TEXT NOT NULL,
  external_id TEXT NOT NULL CHECK (length(external_id) BETWEEN 1 AND 128),
  reason_code TEXT NOT NULL CHECK (length(reason_code) BETWEEN 2 AND 64),
  payload_hash TEXT NOT NULL CHECK (length(payload_hash) = 64),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'approved', 'rejected')),
  reviewed_by_account_id TEXT,
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  FOREIGN KEY (source_id) REFERENCES legal_sources(id) ON DELETE RESTRICT,
  FOREIGN KEY (reviewed_by_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) STRICT;

INSERT INTO feature_flags (key, enabled, description)
VALUES
  ('legal_knowledge_search', 1, 'Verified D1 FTS5 legal knowledge retrieval'),
  ('legal_semantic_search', 0, 'Vectorize semantic legal search; disabled until authorized')
ON CONFLICT(key) DO UPDATE SET description = excluded.description;

UPDATE system_settings
SET value_json = '"legal_knowledge_base"',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE key = 'platform_status';
