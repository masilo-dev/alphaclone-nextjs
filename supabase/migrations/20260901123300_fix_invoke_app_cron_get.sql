-- Cron routes use GET; pg_net must match Railway cron semantics.

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

COMMENT ON FUNCTION public.invoke_app_cron(text) IS
  'GETs AlphaClone cron routes using platform_global_settings.cron_secret and app_base_url.';
