-- Compatibility rollback for functions hardened by the matching migration.
-- This is intentionally broad only across SECURITY DEFINER functions whose
-- search_path exactly matches the hardening value.
BEGIN;
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) setting
        WHERE setting = 'search_path=public, extensions, pg_temp'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s RESET search_path', fn.signature);
  END LOOP;
END $$;
COMMIT;
