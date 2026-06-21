-- Migration: 002_job_flow_tables
-- Creates tables for employer pings (messages), cohort management, retention checks, and MIS reports

-- ─── Enums ─────────────────────────────────────────────────────────────────

CREATE TYPE message_direction AS ENUM ('to_learner', 'from_learner');
CREATE TYPE message_source AS ENUM ('whatsapp', 'dashboard', 'bot');
CREATE TYPE message_status AS ENUM ('sent', 'delivered', 'read', 'failed');
CREATE TYPE retention_check_status AS ENUM ('pending', 'retained', 'left', 'no_response');
CREATE TYPE mis_report_status AS ENUM ('generating', 'ready', 'submitted', 'failed');

-- ─── messages (Employer/Officer ↔ Learner pings) ───────────────────────────

CREATE TABLE IF NOT EXISTS public.messages (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  receiver_learner_id UUID NOT NULL REFERENCES public.learners(id) ON DELETE RESTRICT,
  direction           message_direction NOT NULL,
  content             TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  source              message_source NOT NULL DEFAULT 'whatsapp',
  status              message_status NOT NULL DEFAULT 'sent',
  reply_to_id         UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_sender           ON public.messages(sender_id);
CREATE INDEX idx_messages_receiver         ON public.messages(receiver_learner_id);
CREATE INDEX idx_messages_reply_to         ON public.messages(reply_to_id);
CREATE INDEX idx_messages_created_at       ON public.messages(created_at);
CREATE INDEX idx_messages_sender_receiver  ON public.messages(sender_id, receiver_learner_id, created_at);

-- -- ─── cohorts ───────────────────────────────────────────────────────────────

-- CREATE TABLE IF NOT EXISTS public.cohorts (
--   id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   name                 TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
--   officer_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
--   source_document_url  TEXT,
--   extraction_metadata  JSONB NOT NULL DEFAULT '{}',
--   created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--   updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- -- Unique cohort name per officer
-- CREATE UNIQUE INDEX idx_cohorts_officer_name ON public.cohorts(officer_id, name);
-- CREATE INDEX idx_cohorts_officer            ON public.cohorts(officer_id);
-- CREATE INDEX idx_cohorts_created_at         ON public.cohorts(created_at);

-- ─── retention_checks ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.retention_checks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  placement_id    UUID NOT NULL REFERENCES public.placements(id) ON DELETE CASCADE,
  learner_id      UUID NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  check_day       INTEGER NOT NULL CHECK (check_day IN (7, 30, 60, 90)),
  status          retention_check_status NOT NULL DEFAULT 'pending',
  salary_reported NUMERIC(12, 2),
  notes           TEXT,
  checked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one check per placement per check_day
CREATE UNIQUE INDEX idx_retention_checks_placement_day ON public.retention_checks(placement_id, check_day);
CREATE INDEX idx_retention_checks_placement           ON public.retention_checks(placement_id);
CREATE INDEX idx_retention_checks_learner             ON public.retention_checks(learner_id);
CREATE INDEX idx_retention_checks_status              ON public.retention_checks(status);
CREATE INDEX idx_retention_checks_created_at          ON public.retention_checks(created_at);

-- ─── mis_reports ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mis_reports (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  officer_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  cohort        TEXT,
  period_from   DATE NOT NULL,
  period_to     DATE NOT NULL,
  report_data   JSONB NOT NULL DEFAULT '{}',
  file_url      TEXT,
  status        mis_report_status NOT NULL DEFAULT 'generating',
  submitted_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mis_reports_officer    ON public.mis_reports(officer_id);
CREATE INDEX idx_mis_reports_status     ON public.mis_reports(status);
CREATE INDEX idx_mis_reports_period     ON public.mis_reports(period_from, period_to);
CREATE INDEX idx_mis_reports_created_at ON public.mis_reports(created_at);

-- ─── updated_at triggers for tables with updated_at column ─────────────────

CREATE TRIGGER trg_cohorts_updated_at
  BEFORE UPDATE ON public.cohorts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Grants ────────────────────────────────────────────────────────────────

GRANT ALL PRIVILEGES ON TABLE public.messages TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.cohorts TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.retention_checks TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.mis_reports TO service_role;
