-- Migration 004: Aadhaar KYC columns
-- Adds columns for Aadhaar-based KYC verification and document URLs.

ALTER TABLE learners
  ADD COLUMN IF NOT EXISTS aadhaar_number      TEXT,
  ADD COLUMN IF NOT EXISTS dob                 DATE,
  ADD COLUMN IF NOT EXISTS gender              TEXT,
  ADD COLUMN IF NOT EXISTS address_line        TEXT,
  ADD COLUMN IF NOT EXISTS address_district    TEXT,
  ADD COLUMN IF NOT EXISTS address_state       TEXT,
  ADD COLUMN IF NOT EXISTS address_pincode     TEXT,
  ADD COLUMN IF NOT EXISTS kyc_status          TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS aadhaar_photo_url   TEXT,
  ADD COLUMN IF NOT EXISTS certificate_url     TEXT;

ALTER TABLE skill_cards
  ADD COLUMN IF NOT EXISTS certificate_url TEXT;
