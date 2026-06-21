-- Migration 006: Language preference and placement details
-- Adds user language preference and placement detail columns to learners table

-- Language preference (english, hindi, hinglish, marathi, gujarati, bengali)
ALTER TABLE learners ADD COLUMN IF NOT EXISTS language TEXT;

-- Placement details collected from the learner via WhatsApp
ALTER TABLE learners ADD COLUMN IF NOT EXISTS placement_company TEXT;
ALTER TABLE learners ADD COLUMN IF NOT EXISTS placement_role TEXT;
ALTER TABLE learners ADD COLUMN IF NOT EXISTS placement_salary TEXT;
ALTER TABLE learners ADD COLUMN IF NOT EXISTS placement_location TEXT;
ALTER TABLE learners ADD COLUMN IF NOT EXISTS placement_date TEXT;
ALTER TABLE learners ADD COLUMN IF NOT EXISTS placement_reported_at TIMESTAMPTZ;
