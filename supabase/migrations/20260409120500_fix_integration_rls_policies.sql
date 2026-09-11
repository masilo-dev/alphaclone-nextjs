-- FIX: Integration RLS policies were using current_setting('app.current_tenant_id')
-- which is never set by the Supabase client, causing all SELECT queries from the
-- frontend to return 0 rows (the "Connect your account" bug).
-- Replace with auth.uid() = user_id which is the standard Supabase RLS pattern.

DO $$
BEGIN
  IF to_regclass('public.facebook_integrations') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own tenant facebook integrations" ON public.facebook_integrations;
    DROP POLICY IF EXISTS "Users can manage own tenant facebook integrations" ON public.facebook_integrations;
    DROP POLICY IF EXISTS "Users can view own facebook integrations" ON public.facebook_integrations;
    DROP POLICY IF EXISTS "Users can manage own facebook integrations" ON public.facebook_integrations;
    CREATE POLICY "Users can view own facebook integrations" ON public.facebook_integrations
      FOR SELECT USING (user_id = auth.uid());
    CREATE POLICY "Users can manage own facebook integrations" ON public.facebook_integrations
      FOR ALL USING (user_id = auth.uid());
  END IF;

  IF to_regclass('public.slack_integrations') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own tenant slack integrations" ON public.slack_integrations;
    DROP POLICY IF EXISTS "Users can manage own tenant slack integrations" ON public.slack_integrations;
    DROP POLICY IF EXISTS "Users can view own slack integrations" ON public.slack_integrations;
    DROP POLICY IF EXISTS "Users can manage own slack integrations" ON public.slack_integrations;
    CREATE POLICY "Users can view own slack integrations" ON public.slack_integrations
      FOR SELECT USING (tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
      ));
    CREATE POLICY "Users can manage own slack integrations" ON public.slack_integrations
      FOR ALL USING (tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
      ));
  END IF;

  IF to_regclass('public.google_calendar_integrations') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own tenant google calendar integrations" ON public.google_calendar_integrations;
    DROP POLICY IF EXISTS "Users can manage own tenant google calendar integrations" ON public.google_calendar_integrations;
    DROP POLICY IF EXISTS "Users can view own google calendar integrations" ON public.google_calendar_integrations;
    DROP POLICY IF EXISTS "Users can manage own google calendar integrations" ON public.google_calendar_integrations;
    CREATE POLICY "Users can view own google calendar integrations" ON public.google_calendar_integrations
      FOR SELECT USING (user_id = auth.uid());
    CREATE POLICY "Users can manage own google calendar integrations" ON public.google_calendar_integrations
      FOR ALL USING (user_id = auth.uid());
  END IF;

  IF to_regclass('public.integrations') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own tenant integrations" ON public.integrations;
    DROP POLICY IF EXISTS "Users can manage own tenant integrations" ON public.integrations;
    DROP POLICY IF EXISTS "Users can view own integrations" ON public.integrations;
    DROP POLICY IF EXISTS "Users can manage own integrations" ON public.integrations;
    CREATE POLICY "Users can view own integrations" ON public.integrations
      FOR SELECT USING (user_id = auth.uid());
    CREATE POLICY "Users can manage own integrations" ON public.integrations
      FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;
