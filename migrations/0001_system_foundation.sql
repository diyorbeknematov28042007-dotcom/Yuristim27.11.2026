PRAGMA foreign_keys = ON;

CREATE TABLE system_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value_json TEXT NOT NULL CHECK (json_valid(value_json)),
  is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE feature_flags (
  key TEXT PRIMARY KEY NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  description TEXT NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(config_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY NOT NULL,
  parent_event_id TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('system', 'user', 'admin', 'service')),
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  request_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (parent_event_id) REFERENCES audit_events(id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX idx_audit_events_created_at ON audit_events(created_at);
CREATE INDEX idx_audit_events_entity ON audit_events(entity_type, entity_id, created_at);
CREATE INDEX idx_audit_events_request_id ON audit_events(request_id);

CREATE TRIGGER audit_events_no_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events are append-only');
END;

CREATE TRIGGER audit_events_no_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events are append-only');
END;

CREATE TABLE idempotency_keys (
  id TEXT PRIMARY KEY NOT NULL,
  scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER CHECK (response_status BETWEEN 100 AND 599),
  response_body_json TEXT CHECK (response_body_json IS NULL OR json_valid(response_body_json)),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (scope, idempotency_key)
) STRICT;

CREATE INDEX idx_idempotency_keys_expires_at ON idempotency_keys(expires_at);
