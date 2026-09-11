-- Extend Supabase pg_cron backup for task reminders, scheduled AI tasks, and invoice follow-ups.

DO $migration$
DECLARE
  cron_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN;
  END IF;

  FOREACH cron_name IN ARRAY ARRAY[
      'process-task-reminders',
      'process-scheduled-ai-tasks',
      'process-invoice-overdue-reminders'
    ]
  LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = cron_name) THEN
      PERFORM cron.unschedule(cron_name);
    END IF;
  END LOOP;

  PERFORM cron.schedule(
    'process-task-reminders',
    '*/15 * * * *',
    $$SELECT public.invoke_app_cron('/api/cron/process-task-reminders');$$
  );
  PERFORM cron.schedule(
    'process-scheduled-ai-tasks',
    '*/5 * * * *',
    $$SELECT public.invoke_app_cron('/api/cron/process-scheduled-ai-tasks');$$
  );
  PERFORM cron.schedule(
    'process-invoice-overdue-reminders',
    '0 8 * * *',
    $$SELECT public.invoke_app_cron('/api/cron/process-invoice-overdue-reminders');$$
  );
END
$migration$;
