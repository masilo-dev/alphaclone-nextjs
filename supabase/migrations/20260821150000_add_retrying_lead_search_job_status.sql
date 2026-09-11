-- Add 'retrying' enum value to lead_search_job_status for retryable lead discovery jobs.
-- Prevents Postgres SQL_STATE 22P02 (invalid input value for enum) during worker claim/retry queries.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_search_job_status') THEN
    ALTER TYPE public.lead_search_job_status ADD VALUE IF NOT EXISTS 'retrying' AFTER 'running';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
