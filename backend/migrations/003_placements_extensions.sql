-- Migration: 003_placements_extensions
-- Extends the placements table with salary capture, retention tracking, and tenure columns

-- ─── Enums ─────────────────────────────────────────────────────────────────

CREATE TYPE retention_status AS ENUM ('active', 'left', 'unknown');

-- ─── placements — new columns ──────────────────────────────────────────────

ALTER TABLE public.placements
  ADD COLUMN salary_reported    NUMERIC(12, 2),
  ADD COLUMN current_salary     NUMERIC(12, 2),
  ADD COLUMN retention_status   retention_status NOT NULL DEFAULT 'unknown',
  ADD COLUMN left_at            TIMESTAMPTZ,
  ADD COLUMN tenure_days        INTEGER;

COMMENT ON COLUMN public.placements.salary_reported  IS 'Learner-reported salary captured by bot (7-day nudge)';
COMMENT ON COLUMN public.placements.current_salary   IS 'Latest known salary, updated at 90-day retention check';
COMMENT ON COLUMN public.placements.retention_status IS 'Current retention status: active, left, or unknown';
COMMENT ON COLUMN public.placements.left_at          IS 'Timestamp when learner reported leaving the job';
COMMENT ON COLUMN public.placements.tenure_days      IS 'Computed duration: left_at - placement_date (in days)';

-- ─── Index for retention status filtering ──────────────────────────────────

CREATE INDEX idx_placements_retention_status ON public.placements(retention_status);
