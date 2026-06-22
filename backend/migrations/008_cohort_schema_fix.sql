-- Migration: 008_cohort_schema_fix
-- Adds missing columns to cohorts table that the application expects

ALTER TABLE public.cohorts
  ADD COLUMN IF NOT EXISTS source_document_url TEXT,
  ADD COLUMN IF NOT EXISTS extraction_metadata JSONB NOT NULL DEFAULT '{}';
