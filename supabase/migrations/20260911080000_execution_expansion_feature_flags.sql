-- AlphaClone execution-expansion rollout gates.
-- Safe by default: infrastructure and code may deploy before any tenant is exposed.
-- Existing feature_flags rows are preserved.

DO $$
BEGIN
  IF to_regclass('public.feature_flags') IS NULL THEN
    RAISE NOTICE 'public.feature_flags does not exist; skipping execution expansion flag seed';
    RETURN;
  END IF;

  INSERT INTO public.feature_flags (key, enabled, value, tenant_id)
  SELECT flag_key, false, 'false'::jsonb, NULL
  FROM unnest(ARRAY[
    'PROJECTS_V2',
    'LISTMONK_ENABLED',
    'PENPOT_ENABLED',
    'CLIENT_APPROVALS_ENABLED',
    'PROJECT_AUTOMATION_ENABLED'
  ]::text[]) AS flag_key
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.feature_flags existing
    WHERE existing.key = flag_key
      AND existing.tenant_id IS NULL
  );
END $$;
