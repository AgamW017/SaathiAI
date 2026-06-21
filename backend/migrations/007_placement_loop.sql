-- ============================================================
-- Migration 007: Placement loop — salary claim tracking + indexes
-- ============================================================
-- Supports the end-to-end employer→learner→officer placement loop:
--   * salary_claimed  — the salary asserted at hire time (employer offer or
--                       officer-entered claim). Compared against the bot-captured
--                       salary_reported / current_salary to flag discrepancies.
--   * recent-placement lookups for the officer "New Placement" feed.

ALTER TABLE public.placements
  ADD COLUMN IF NOT EXISTS salary_claimed NUMERIC(12, 2);

COMMENT ON COLUMN public.placements.salary_claimed IS
  'Salary asserted at hire (employer offer or officer claim); baseline for discrepancy detection vs bot-reported salary';

-- Fast "new placements in last N days" feed for the officer dashboard
CREATE INDEX IF NOT EXISTS idx_placements_created_at ON public.placements(created_at DESC);

-- Demand-signal map / labour-market feed aggregate over active vacancies by
-- district + trade; index keeps the group-by cheap.
CREATE INDEX IF NOT EXISTS idx_vacancies_district_trade
  ON public.vacancies(district, trade_required) WHERE status = 'active';
