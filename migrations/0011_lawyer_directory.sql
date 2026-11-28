PRAGMA foreign_keys = ON;

CREATE TABLE lawyer_specializations (
  code TEXT PRIMARY KEY NOT NULL CHECK (length(code) BETWEEN 2 AND 64),
  name_uz TEXT NOT NULL CHECK (length(name_uz) BETWEEN 2 AND 128),
  name_ru TEXT NOT NULL CHECK (length(name_ru) BETWEEN 2 AND 128),
  name_en TEXT NOT NULL CHECK (length(name_en) BETWEEN 2 AND 128),
  sort_order INTEGER NOT NULL UNIQUE CHECK (sort_order BETWEEN 1 AND 100),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
) STRICT;

CREATE TABLE lawyer_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL UNIQUE,
  public_slug TEXT NOT NULL UNIQUE CHECK (length(public_slug) BETWEEN 3 AND 80),
  professional_type TEXT NOT NULL CHECK (professional_type IN ('lawyer', 'advocate')),
  full_name TEXT NOT NULL CHECK (length(full_name) BETWEEN 2 AND 128),
  professional_status TEXT NOT NULL CHECK (length(professional_status) BETWEEN 2 AND 128),
  experience_years INTEGER NOT NULL CHECK (experience_years BETWEEN 0 AND 80),
  region_code TEXT NOT NULL CHECK (length(region_code) BETWEEN 2 AND 64),
  bio_uz TEXT NOT NULL DEFAULT '' CHECK (length(bio_uz) <= 4000),
  bio_ru TEXT NOT NULL DEFAULT '' CHECK (length(bio_ru) <= 4000),
  bio_en TEXT NOT NULL DEFAULT '' CHECK (length(bio_en) <= 4000),
  phone TEXT CHECK (phone IS NULL OR length(phone) BETWEEN 7 AND 32),
  telegram_username TEXT CHECK (telegram_username IS NULL OR length(telegram_username) BETWEEN 1 AND 64),
  contact_visible INTEGER NOT NULL DEFAULT 1 CHECK (contact_visible IN (0, 1)),
  remote_available INTEGER NOT NULL DEFAULT 0 CHECK (remote_available IN (0, 1)),
  office_address TEXT CHECK (office_address IS NULL OR length(office_address) <= 500),
  price_note TEXT CHECK (price_note IS NULL OR length(price_note) <= 500),
  education_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(education_json) AND json_type(education_json) = 'array'),
  services_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(services_json) AND json_type(services_json) = 'array'),
  certificates_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(certificates_json) AND json_type(certificates_json) = 'array'),
  license_number TEXT CHECK (license_number IS NULL OR length(license_number) <= 128),
  license_issuer TEXT CHECK (license_issuer IS NULL OR length(license_issuer) <= 256),
  photo_object_key TEXT,
  verification_status TEXT NOT NULL DEFAULT 'draft' CHECK (verification_status IN ('draft', 'pending', 'verified', 'rejected', 'reverification_required', 'revoked')),
  directory_status TEXT NOT NULL DEFAULT 'hidden' CHECK (directory_status IN ('hidden', 'active', 'restricted', 'blocked')),
  profile_revision INTEGER NOT NULL DEFAULT 1 CHECK (profile_revision > 0),
  verified_revision INTEGER CHECK (verified_revision IS NULL OR verified_revision > 0),
  rejection_reason_code TEXT CHECK (rejection_reason_code IS NULL OR length(rejection_reason_code) <= 64),
  verified_at TEXT,
  verified_by_account_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (verified_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  CHECK (photo_object_key IS NULL OR length(photo_object_key) BETWEEN 1 AND 512),
  CHECK (directory_status <> 'active' OR (verification_status = 'verified' AND verified_revision = profile_revision))
) STRICT;

CREATE INDEX idx_lawyer_profiles_directory ON lawyer_profiles(directory_status, verification_status, region_code, experience_years);
CREATE INDEX idx_lawyer_profiles_account ON lawyer_profiles(account_id);

CREATE TABLE lawyer_profile_specializations (
  profile_id TEXT NOT NULL,
  specialization_code TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  PRIMARY KEY (profile_id, specialization_code),
  FOREIGN KEY (profile_id) REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (specialization_code) REFERENCES lawyer_specializations(code) ON DELETE RESTRICT
) STRICT;

CREATE UNIQUE INDEX idx_lawyer_one_primary_specialization
  ON lawyer_profile_specializations(profile_id) WHERE is_primary = 1;
CREATE INDEX idx_lawyer_specialization_directory
  ON lawyer_profile_specializations(specialization_code, profile_id);

CREATE TABLE lawyer_profile_languages (
  profile_id TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('uz', 'ru', 'en')),
  PRIMARY KEY (profile_id, locale),
  FOREIGN KEY (profile_id) REFERENCES lawyer_profiles(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE lawyer_verification_cases (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL,
  applicant_account_id TEXT NOT NULL,
  profile_revision INTEGER NOT NULL CHECK (profile_revision > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'revoked')),
  applicant_note TEXT CHECK (applicant_note IS NULL OR length(applicant_note) <= 2000),
  decision_reason_code TEXT CHECK (decision_reason_code IS NULL OR length(decision_reason_code) <= 64),
  decision_note TEXT CHECK (decision_note IS NULL OR length(decision_note) <= 2000),
  reviewer_account_id TEXT,
  submitted_at TEXT NOT NULL,
  decided_at TEXT,
  UNIQUE (profile_id, profile_revision),
  FOREIGN KEY (profile_id) REFERENCES lawyer_profiles(id) ON DELETE RESTRICT,
  FOREIGN KEY (applicant_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (reviewer_account_id) REFERENCES accounts(id) ON DELETE SET NULL
) STRICT;

CREATE INDEX idx_lawyer_verification_queue ON lawyer_verification_cases(status, submitted_at);

CREATE TABLE lawyer_verification_documents (
  id TEXT PRIMARY KEY NOT NULL,
  case_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE CHECK (length(object_key) BETWEEN 1 AND 512),
  document_kind TEXT NOT NULL CHECK (length(document_kind) BETWEEN 2 AND 64),
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  uploaded_at TEXT NOT NULL,
  FOREIGN KEY (case_id) REFERENCES lawyer_verification_cases(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE lawyer_verification_actions (
  id TEXT PRIMARY KEY NOT NULL,
  case_id TEXT NOT NULL,
  actor_account_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'revoked', 'resubmitted')),
  reason_code TEXT CHECK (reason_code IS NULL OR length(reason_code) <= 64),
  created_at TEXT NOT NULL,
  FOREIGN KEY (case_id) REFERENCES lawyer_verification_cases(id) ON DELETE RESTRICT,
  FOREIGN KEY (actor_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) STRICT;

CREATE TRIGGER lawyer_verification_actions_no_update BEFORE UPDATE ON lawyer_verification_actions
BEGIN SELECT RAISE(ABORT, 'lawyer verification actions are append-only'); END;
CREATE TRIGGER lawyer_verification_actions_no_delete BEFORE DELETE ON lawyer_verification_actions
BEGIN SELECT RAISE(ABORT, 'lawyer verification actions are append-only'); END;

CREATE TABLE lawyer_favorites (
  account_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (account_id, profile_id),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES lawyer_profiles(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE lawyer_profile_views (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL,
  viewer_account_id TEXT NOT NULL,
  request_id TEXT NOT NULL UNIQUE,
  viewed_at TEXT NOT NULL,
  FOREIGN KEY (profile_id) REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (viewer_account_id) REFERENCES accounts(id) ON DELETE CASCADE
) STRICT;
CREATE INDEX idx_lawyer_views_stats ON lawyer_profile_views(profile_id, viewed_at);

CREATE TABLE lawyer_contact_events (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  contact_type TEXT NOT NULL CHECK (contact_type IN ('phone', 'telegram')),
  request_id TEXT NOT NULL UNIQUE,
  clicked_at TEXT NOT NULL,
  service_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (service_confirmed = 0),
  FOREIGN KEY (profile_id) REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) STRICT;
CREATE INDEX idx_lawyer_contact_stats ON lawyer_contact_events(profile_id, clicked_at);
CREATE INDEX idx_lawyer_contact_review_eligibility ON lawyer_contact_events(account_id, profile_id, clicked_at);
CREATE TRIGGER lawyer_contact_events_no_update BEFORE UPDATE ON lawyer_contact_events
BEGIN SELECT RAISE(ABORT, 'lawyer contact events are append-only'); END;
CREATE TRIGGER lawyer_contact_events_no_delete BEFORE DELETE ON lawyer_contact_events
BEGIN SELECT RAISE(ABORT, 'lawyer contact events are append-only'); END;

CREATE TABLE lawyer_reviews (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL,
  reviewer_account_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT CHECK (body IS NULL OR length(body) <= 3000),
  anonymous INTEGER NOT NULL DEFAULT 0 CHECK (anonymous IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'pending', 'deleted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (profile_id) REFERENCES lawyer_profiles(id) ON DELETE RESTRICT,
  FOREIGN KEY (reviewer_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) STRICT;
CREATE UNIQUE INDEX idx_lawyer_one_active_review
  ON lawyer_reviews(profile_id, reviewer_account_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lawyer_reviews_public ON lawyer_reviews(profile_id, status, created_at);

CREATE TABLE lawyer_review_history (
  id TEXT PRIMARY KEY NOT NULL,
  review_id TEXT NOT NULL,
  actor_account_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'edited', 'deleted', 'hidden', 'restored')),
  rating INTEGER,
  body_hash TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (review_id) REFERENCES lawyer_reviews(id) ON DELETE RESTRICT,
  FOREIGN KEY (actor_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) STRICT;
CREATE TRIGGER lawyer_review_history_no_update BEFORE UPDATE ON lawyer_review_history
BEGIN SELECT RAISE(ABORT, 'lawyer review history is append-only'); END;
CREATE TRIGGER lawyer_review_history_no_delete BEFORE DELETE ON lawyer_review_history
BEGIN SELECT RAISE(ABORT, 'lawyer review history is append-only'); END;

CREATE TABLE lawyer_review_replies (
  review_id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL,
  author_account_id TEXT NOT NULL,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 3000),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (review_id) REFERENCES lawyer_reviews(id) ON DELETE RESTRICT,
  FOREIGN KEY (profile_id) REFERENCES lawyer_profiles(id) ON DELETE RESTRICT,
  FOREIGN KEY (author_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE lawyer_complaints (
  id TEXT PRIMARY KEY NOT NULL,
  complainant_account_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  review_id TEXT,
  category TEXT NOT NULL CHECK (category IN ('identity', 'professional_info', 'conduct', 'review', 'contact', 'fraud', 'other')),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 10 AND 4000),
  evidence_note TEXT CHECK (evidence_note IS NULL OR length(evidence_note) <= 2000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'upheld', 'rejected', 'closed')),
  resolution_note TEXT CHECK (resolution_note IS NULL OR length(resolution_note) <= 2000),
  reviewer_account_id TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  FOREIGN KEY (complainant_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (profile_id) REFERENCES lawyer_profiles(id) ON DELETE RESTRICT,
  FOREIGN KEY (review_id) REFERENCES lawyer_reviews(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewer_account_id) REFERENCES accounts(id) ON DELETE SET NULL
) STRICT;
CREATE INDEX idx_lawyer_complaints_queue ON lawyer_complaints(status, created_at);

CREATE TABLE lawyer_moderation_actions (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL,
  complaint_id TEXT,
  actor_account_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('warning', 'restrict', 'block', 'unblock', 'revoke_verification', 'hide_review', 'restore_review')),
  reason_code TEXT NOT NULL CHECK (length(reason_code) BETWEEN 2 AND 64),
  note TEXT CHECK (note IS NULL OR length(note) <= 2000),
  created_at TEXT NOT NULL,
  FOREIGN KEY (profile_id) REFERENCES lawyer_profiles(id) ON DELETE RESTRICT,
  FOREIGN KEY (complaint_id) REFERENCES lawyer_complaints(id) ON DELETE SET NULL,
  FOREIGN KEY (actor_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) STRICT;
CREATE INDEX idx_lawyer_moderation_profile ON lawyer_moderation_actions(profile_id, created_at);
CREATE TRIGGER lawyer_moderation_actions_no_update BEFORE UPDATE ON lawyer_moderation_actions
BEGIN SELECT RAISE(ABORT, 'lawyer moderation actions are append-only'); END;
CREATE TRIGGER lawyer_moderation_actions_no_delete BEFORE DELETE ON lawyer_moderation_actions
BEGIN SELECT RAISE(ABORT, 'lawyer moderation actions are append-only'); END;

CREATE TABLE lawyer_appeals (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL,
  appellant_account_id TEXT NOT NULL,
  moderation_action_id TEXT NOT NULL,
  statement TEXT NOT NULL CHECK (length(statement) BETWEEN 10 AND 4000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'upheld', 'rejected', 'closed')),
  reviewer_account_id TEXT,
  decision_note TEXT CHECK (decision_note IS NULL OR length(decision_note) <= 2000),
  created_at TEXT NOT NULL,
  decided_at TEXT,
  UNIQUE (moderation_action_id, appellant_account_id),
  FOREIGN KEY (profile_id) REFERENCES lawyer_profiles(id) ON DELETE RESTRICT,
  FOREIGN KEY (appellant_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (moderation_action_id) REFERENCES lawyer_moderation_actions(id) ON DELETE RESTRICT,
  FOREIGN KEY (reviewer_account_id) REFERENCES accounts(id) ON DELETE SET NULL
) STRICT;
CREATE INDEX idx_lawyer_appeals_queue ON lawyer_appeals(status, created_at);

CREATE TRIGGER lawyer_profile_critical_change
AFTER UPDATE OF professional_type, full_name, professional_status, region_code, license_number, license_issuer
ON lawyer_profiles
WHEN OLD.verification_status = 'verified' AND NEW.verification_status = 'verified' AND (
  OLD.professional_type IS NOT NEW.professional_type OR
  OLD.full_name IS NOT NEW.full_name OR
  OLD.professional_status IS NOT NEW.professional_status OR
  OLD.region_code IS NOT NEW.region_code OR
  OLD.license_number IS NOT NEW.license_number OR
  OLD.license_issuer IS NOT NEW.license_issuer
)
BEGIN
  UPDATE lawyer_profiles
  SET verification_status = 'reverification_required',
      directory_status = 'hidden',
      profile_revision = OLD.profile_revision + 1,
      verified_revision = NULL,
      verified_at = NULL,
      verified_by_account_id = NULL
  WHERE id = NEW.id;
END;

UPDATE system_settings
SET value_json = '"lawyer_directory_foundation"',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE key = 'platform_status';
