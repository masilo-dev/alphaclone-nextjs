-- Align the lead-search queue enum with the application state machine.
-- Existing rows and enum labels are preserved.
ALTER TYPE public.lead_search_job_status
  ADD VALUE IF NOT EXISTS 'queued' BEFORE 'running';

