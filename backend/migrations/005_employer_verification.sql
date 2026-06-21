-- ============================================================
-- Migration 005: Employer Verification (Aadhaar + EntityLocker)
-- ============================================================

-- Extend verification_status to include new KYC-verified states
ALTER TABLE employers
  DROP CONSTRAINT IF EXISTS employers_verification_status_check;

ALTER TABLE employers
  ADD CONSTRAINT employers_verification_status_check
    CHECK (verification_status IN (
      'unverified',
      'phone_verified',
      'udyam_verified',
      'aadhaar_verified',
      'entitylocker_verified',
      'fully_verified'
    ));

-- Aadhaar KYC columns for employer
ALTER TABLE employers
  ADD COLUMN IF NOT EXISTS contact_name            TEXT,
  ADD COLUMN IF NOT EXISTS verification_type       TEXT NOT NULL DEFAULT 'none'
                             CHECK (verification_type IN ('none', 'aadhaar', 'entitylocker')),
  ADD COLUMN IF NOT EXISTS aadhaar_name            TEXT,
  ADD COLUMN IF NOT EXISTS aadhaar_dob             TEXT,
  ADD COLUMN IF NOT EXISTS aadhaar_gender          TEXT,
  ADD COLUMN IF NOT EXISTS aadhaar_address         JSONB,
  ADD COLUMN IF NOT EXISTS aadhaar_photo_url       TEXT,
  -- EntityLocker fields
  ADD COLUMN IF NOT EXISTS entity_id               TEXT,
  ADD COLUMN IF NOT EXISTS entity_date_of_incorp   TEXT,
  ADD COLUMN IF NOT EXISTS entity_verified_by      TEXT
                             CHECK (entity_verified_by IN ('pan', 'ud', 'cin') OR entity_verified_by IS NULL);

CREATE INDEX IF NOT EXISTS idx_employers_verification_type ON employers(verification_type);
