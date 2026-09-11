-- Restore PostgreSQL's legacy owner-rights view behavior if compatibility
-- requires it. No view definition or data is changed.
BEGIN;
DO $$
DECLARE view_name text;
BEGIN
  FOREACH view_name IN ARRAY ARRAY[
    'user_tenant_roles',
    'facebook_integrations_safe',
    'linkedin_integrations_safe',
    'unified_tickets'
  ] LOOP
    IF to_regclass(format('public.%I', view_name)) IS NOT NULL THEN
      EXECUTE format(
        'ALTER VIEW public.%I SET (security_invoker = false)',
        view_name
      );
    END IF;
  END LOOP;
END $$;
COMMIT;
