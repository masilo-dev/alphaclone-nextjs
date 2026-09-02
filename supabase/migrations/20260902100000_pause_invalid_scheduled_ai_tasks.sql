-- Pause scheduled AI tasks with invalid five-field cron expressions.
-- These were causing @workflow/world-local retry loops and heap OOM in production.

UPDATE public.scheduled_ai_tasks
SET
  status = 'paused',
  updated_at = NOW()
WHERE status = 'active'
  AND (
    schedule IS NULL
    OR btrim(schedule) = ''
    OR array_length(regexp_split_to_array(btrim(schedule), '\s+'), 1) <> 5
    OR schedule !~ '^(?:\*|\d{1,2}(?:,\d{1,2})*)(?:\s+(?:\*|\d{1,2}(?:,\d{1,2})*)){4}$'
  );
