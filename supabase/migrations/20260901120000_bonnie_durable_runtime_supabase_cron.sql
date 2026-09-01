-- Supabase pg_cron backup for Bonnie durable runtime + critical automation HTTP crons.
-- Reads bearer token + base URL from platform_global_settings (no secrets in SQL).
-- Railway remains primary; these jobs no-op until settings.cron_secret is configured.

CREATE OR REPLACE FUNCTION public.invoke_app_cron(p_path text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_settings jsonb;
  v_secret text;
  v_base text;
  v_url text;
  v_request_id bigint;
BEGIN
  IF p_path IS NULL OR btrim(p_path) = '' OR left(btrim(p_path), 1) <> '/' THEN
    RAISE EXCEPTION 'invoke_app_cron requires an absolute path starting with /';
  END IF;

  SELECT settings
  INTO v_settings
  FROM public.platform_global_settings
  WHERE singleton_key = 'default';

  v_secret := nullif(btrim(v_settings->>'cron_secret'), '');
  v_base := nullif(btrim(v_settings->>'app_base_url'), '');
  IF v_base IS NULL THEN
    v_base := 'https://alphaclonesystems.com';
  END IF;

  IF v_secret IS NULL THEN
    RAISE WARNING 'invoke_app_cron skipped %: platform_global_settings.cron_secret not configured', p_path;
    RETURN NULL;
  END IF;

  v_url := rtrim(v_base, '/') || p_path;

  SELECT net.http_get(
    url := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret
    )
  )
  INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_app_cron(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invoke_app_cron(text) FROM anon, authenticated;

COMMENT ON FUNCTION public.invoke_app_cron(text) IS
  'GETs AlphaClone cron routes using platform_global_settings.cron_secret and app_base_url.';

UPDATE public.platform_global_settings
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
  'app_base_url', COALESCE(nullif(btrim(settings->>'app_base_url'), ''), 'https://alphaclonesystems.com')
),
updated_at = now()
WHERE singleton_key = 'default';

DO $migration$
DECLARE
  cron_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed; skipping platform cron schedule';
    RETURN;
  END IF;

  FOREACH cron_name IN ARRAY ARRAY[
      'bonnie-runtime-worker',
      'bonnie-runtime-outbox',
      'bonnie-runtime-reconcile',
      'bonnie-runtime-timers',
      'process-events',
      'social-publish',
      'process-mcp-event-queue',
      'retry-failed'
    ]
  LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = cron_name) THEN
      PERFORM cron.unschedule(cron_name);
    END IF;
  END LOOP;

  PERFORM cron.schedule(
    'bonnie-runtime-worker',
    '*/2 * * * *',
    $$SELECT public.invoke_app_cron('/api/cron/bonnie-runtime-worker');$$
  );
  PERFORM cron.schedule(
    'bonnie-runtime-outbox',
    '*/1 * * * *',
    $$SELECT public.invoke_app_cron('/api/cron/bonnie-runtime-outbox');$$
  );
  PERFORM cron.schedule(
    'bonnie-runtime-reconcile',
    '*/5 * * * *',
    $$SELECT public.invoke_app_cron('/api/cron/bonnie-runtime-reconcile');$$
  );
  PERFORM cron.schedule(
    'bonnie-runtime-timers',
    '*/2 * * * *',
    $$SELECT public.invoke_app_cron('/api/cron/bonnie-runtime-timers');$$
  );
  PERFORM cron.schedule(
    'process-events',
    '*/5 * * * *',
    $$SELECT public.invoke_app_cron('/api/cron/process-events');$$
  );
  PERFORM cron.schedule(
    'social-publish',
    '*/5 * * * *',
    $$SELECT public.invoke_app_cron('/api/cron/social-publish');$$
  );
  PERFORM cron.schedule(
    'process-mcp-event-queue',
    '*/2 * * * *',
    $$SELECT public.invoke_app_cron('/api/cron/process-mcp-event-queue');$$
  );
  PERFORM cron.schedule(
    'retry-failed',
    '0 * * * *',
    $$SELECT public.invoke_app_cron('/api/cron/retry-failed');$$
  );
END
$migration$;

NOTIFY pgrst, 'reload schema';
