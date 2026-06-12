-- Migration: 001_initial_schema
-- Creates all core tables, enums, indexes, and RLS policies

-- ─── Extensions ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fuzzy search on names

-- ─── Enums ─────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('employer', 'trainee', 'officer', 'dssdo', 'admin');
CREATE TYPE learner_status AS ENUM ('active', 'placed', 'dropped', 'at_risk');
CREATE TYPE application_status AS ENUM ('applied', 'shortlisted', 'interviewed', 'hired', 'rejected');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE event_source AS ENUM ('bot', 'backend', 'manual');

-- ─── users (profile table — mirrors auth.users) ────────────────────────────

CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT UNIQUE,
  phone       TEXT UNIQUE,
  role        user_role NOT NULL DEFAULT 'trainee',
  full_name   TEXT,
  district    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role      ON public.users(role);
CREATE INDEX idx_users_district  ON public.users(district);
CREATE INDEX idx_users_phone     ON public.users(phone);

-- ─── learners ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.learners (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone       TEXT NOT NULL UNIQUE,
  full_name   TEXT,
  trade       TEXT,
  district    TEXT,
  state       TEXT,
  cohort      TEXT,
  status      learner_status NOT NULL DEFAULT 'active',
  risk_score  SMALLINT NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  officer_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_learners_phone      ON public.learners(phone);
CREATE INDEX idx_learners_status     ON public.learners(status);
CREATE INDEX idx_learners_district   ON public.learners(district);
CREATE INDEX idx_learners_trade      ON public.learners(trade);
CREATE INDEX idx_learners_cohort     ON public.learners(cohort);
CREATE INDEX idx_learners_created_at ON public.learners(created_at);
CREATE INDEX idx_learners_risk_score ON public.learners(risk_score);
CREATE INDEX idx_learners_officer    ON public.learners(officer_id);
-- Trigram index for fuzzy name search
CREATE INDEX idx_learners_name_trgm  ON public.learners USING gin(full_name gin_trgm_ops);

-- ─── sessions ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  learner_id  UUID NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  step        TEXT NOT NULL DEFAULT 'START',
  data        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_learner    ON public.sessions(learner_id);
CREATE INDEX idx_sessions_created_at ON public.sessions(created_at);

-- ─── jobs ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.jobs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  company       TEXT NOT NULL,
  location      TEXT,
  trade         TEXT,
  description   TEXT,
  requirements  TEXT,
  salary_range  TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  posted_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jobs_trade      ON public.jobs(trade);
CREATE INDEX idx_jobs_is_active  ON public.jobs(is_active);
CREATE INDEX idx_jobs_created_at ON public.jobs(created_at);

-- ─── applications ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.applications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  learner_id  UUID NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  job_id      UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  status      application_status NOT NULL DEFAULT 'applied',
  notes       TEXT,
  officer_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(learner_id, job_id)
);

CREATE INDEX idx_applications_learner ON public.applications(learner_id);
CREATE INDEX idx_applications_job     ON public.applications(job_id);
CREATE INDEX idx_applications_status  ON public.applications(status);

-- ─── skill_cards ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.skill_cards (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  learner_id          UUID NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  trade               TEXT NOT NULL,
  skills              TEXT[] NOT NULL DEFAULT '{}',
  certificate_type    TEXT,
  verification_status verification_status NOT NULL DEFAULT 'pending',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_skill_cards_learner ON public.skill_cards(learner_id);
CREATE INDEX idx_skill_cards_trade   ON public.skill_cards(trade);

-- ─── placements ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.placements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  learner_id      UUID NOT NULL REFERENCES public.learners(id) ON DELETE RESTRICT,
  job_id          UUID NOT NULL REFERENCES public.jobs(id) ON DELETE RESTRICT,
  confirmed_by    UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  placement_date  DATE NOT NULL,
  salary          NUMERIC(12, 2),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_placements_learner        ON public.placements(learner_id);
CREATE INDEX idx_placements_job            ON public.placements(job_id);
CREATE INDEX idx_placements_placement_date ON public.placements(placement_date);

-- ─── events ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  learner_id  UUID REFERENCES public.learners(id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL,
  source      event_source NOT NULL DEFAULT 'backend',
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_learner    ON public.events(learner_id);
CREATE INDEX idx_events_type       ON public.events(event_type);
CREATE INDEX idx_events_source     ON public.events(source);
CREATE INDEX idx_events_created_at ON public.events(created_at);

-- ─── updated_at trigger function ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_learners_updated_at
  BEFORE UPDATE ON public.learners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_skill_cards_updated_at
  BEFORE UPDATE ON public.skill_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


GRANT ALL PRIVILEGES ON TABLE public.users TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.learners TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.sessions TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.jobs TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.applications TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.skill_cards TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.placements TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.events TO service_role;