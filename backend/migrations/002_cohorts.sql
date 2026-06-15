-- Migration: 002_cohorts
-- Creates cohorts table and migrates learners to use cohort_id

CREATE TABLE IF NOT EXISTS public.cohorts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  officer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cohorts_officer_id ON public.cohorts(officer_id);

CREATE TRIGGER trg_cohorts_updated_at
  BEFORE UPDATE ON public.cohorts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT ALL PRIVILEGES ON TABLE public.cohorts TO service_role;

ALTER TABLE public.learners ADD COLUMN cohort_id UUID REFERENCES public.cohorts(id) ON DELETE SET NULL;
CREATE INDEX idx_learners_cohort_id ON public.learners(cohort_id);

-- Migrate existing text cohort data to actual cohorts
DO $$
DECLARE
    r RECORD;
    new_cohort_id UUID;
BEGIN
    FOR r IN SELECT DISTINCT cohort, officer_id FROM public.learners WHERE cohort IS NOT NULL AND officer_id IS NOT NULL LOOP
        INSERT INTO public.cohorts (name, officer_id)
        VALUES (r.cohort, r.officer_id)
        RETURNING id INTO new_cohort_id;
        
        UPDATE public.learners
        SET cohort_id = new_cohort_id
        WHERE cohort = r.cohort AND officer_id = r.officer_id;
    END LOOP;
END $$;

ALTER TABLE public.learners DROP COLUMN cohort;
