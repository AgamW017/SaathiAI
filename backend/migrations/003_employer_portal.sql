-- ============================================================
-- Migration 003: Employer Portal Tables
-- ============================================================

-- ─── Employers ───────────────────────────────────────────────
-- One-to-one with users WHERE role = 'employer'
CREATE TABLE IF NOT EXISTS employers (
  id                    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name          TEXT NOT NULL,
  udyam_number          TEXT UNIQUE,
  gstin                 TEXT,
  district              TEXT,
  state                 TEXT,
  address               TEXT,
  total_employees       INT DEFAULT 0 CHECK (total_employees >= 0),
  trade_categories      TEXT[] DEFAULT '{}',
  verification_status   TEXT NOT NULL DEFAULT 'unverified'
                          CHECK (verification_status IN (
                            'unverified', 'phone_verified', 'udyam_verified', 'fully_verified'
                          )),
  employer_risk_score   INT NOT NULL DEFAULT 50 CHECK (employer_risk_score BETWEEN 0 AND 100),
  naps_registered       BOOLEAN NOT NULL DEFAULT false,
  naps_registration_ref TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Vacancies ───────────────────────────────────────────────
-- Structured job postings created by employers (extends / replaces flat `jobs`)
CREATE TABLE IF NOT EXISTS vacancies (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id             UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  title                   TEXT NOT NULL,
  trade_required          TEXT NOT NULL,
  nsqf_level_min          INT CHECK (nsqf_level_min BETWEEN 1 AND 8),
  nsqf_level_max          INT CHECK (nsqf_level_max BETWEEN 1 AND 8),
  salary_min              INT NOT NULL CHECK (salary_min >= 0),
  salary_max              INT NOT NULL CHECK (salary_max >= salary_min),
  location                TEXT,
  district                TEXT,
  state                   TEXT,
  description             TEXT,
  working_hours           TEXT,
  shift_type              TEXT NOT NULL DEFAULT 'day'
                            CHECK (shift_type IN ('day', 'night', 'rotational')),
  naps_eligible           BOOLEAN NOT NULL DEFAULT false,
  openings                INT NOT NULL DEFAULT 1 CHECK (openings >= 1),
  minimum_wage_compliant  BOOLEAN NOT NULL DEFAULT true,
  status                  TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'active', 'paused', 'closed', 'flagged')),
  expires_at              TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '60 days'),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Matches ─────────────────────────────────────────────────
-- Pipeline state machine: one row per learner × vacancy pairing
CREATE TABLE IF NOT EXISTS matches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id            UUID NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
  learner_id            UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  employer_id           UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  stage                 TEXT NOT NULL DEFAULT 'new_match'
                          CHECK (stage IN (
                            'new_match',
                            'skill_card_viewed',
                            'interest_expressed',
                            'interview_scheduled',
                            'interview_completed',
                            'offer_extended',
                            'hired',
                            'rejected'
                          )),
  skill_card_token      TEXT UNIQUE,
  skill_card_token_exp  TIMESTAMPTZ,
  interview_at          TIMESTAMPTZ,
  offer_salary          INT,
  -- timeline is an array of {stage, timestamp, actor, note} events
  timeline              JSONB NOT NULL DEFAULT '[]',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vacancy_id, learner_id)
);

-- ─── NAPS Claims ─────────────────────────────────────────────
-- Tracks monthly stipend claims per apprentice
CREATE TABLE IF NOT EXISTS naps_claims (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id      UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  vacancy_id       UUID NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
  learner_id       UUID REFERENCES learners(id) ON DELETE SET NULL,
  stipend_amount   INT NOT NULL DEFAULT 1500,
  claim_month      TEXT NOT NULL,  -- format: 'YYYY-MM'
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'submitted', 'approved', 'rejected')),
  submission_ref   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vacancies_employer_id  ON vacancies(employer_id);
CREATE INDEX IF NOT EXISTS idx_vacancies_status       ON vacancies(status);
CREATE INDEX IF NOT EXISTS idx_vacancies_trade        ON vacancies(trade_required);
CREATE INDEX IF NOT EXISTS idx_matches_employer_id    ON matches(employer_id);
CREATE INDEX IF NOT EXISTS idx_matches_learner_id     ON matches(learner_id);
CREATE INDEX IF NOT EXISTS idx_matches_vacancy_id     ON matches(vacancy_id);
CREATE INDEX IF NOT EXISTS idx_matches_stage          ON matches(stage);
CREATE INDEX IF NOT EXISTS idx_naps_claims_employer   ON naps_claims(employer_id);

-- ─── Updated-at triggers ─────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS employers_updated_at ON employers;
CREATE TRIGGER employers_updated_at
  BEFORE UPDATE ON employers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS vacancies_updated_at ON vacancies;
CREATE TRIGGER vacancies_updated_at
  BEFORE UPDATE ON vacancies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS matches_updated_at ON matches;
CREATE TRIGGER matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
