-- Make public views honor the caller's RLS policies instead of the view owner's
-- privileges. This resolves Supabase security_definer_view errors without
-- changing view columns or underlying data.
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
        'ALTER VIEW public.%I SET (security_invoker = true)',
        view_name
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
