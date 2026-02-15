DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT proname, oidvectortypes(proargtypes) as args
             FROM pg_proc
             WHERE proname IN ('track_upgrade_prompt', 'record_prompt_click', 'record_conversion', 
                               'purchase_addon', 'get_conversion_metrics', 'log_audit_event', 
                               'record_user_consent', 'should_retain_data', 'cleanup_old_data')
             AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(r.proname) || '(' || r.args || ') CASCADE';
    END LOOP;
END $$;
