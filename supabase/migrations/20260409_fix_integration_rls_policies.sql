-- FIX: Integration RLS policies were using current_setting('app.current_tenant_id')
-- which is never set by the Supabase client, causing all SELECT queries from the
-- frontend to return 0 rows (the "Connect your account" bug).
-- Replace with auth.uid() = user_id which is the standard Supabase RLS pattern.

-- ── facebook_integrations ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own tenant facebook integrations" ON facebook_integrations;
DROP POLICY IF EXISTS "Users can manage own tenant facebook integrations" ON facebook_integrations;
DROP POLICY IF EXISTS "Users can view own facebook integrations" ON facebook_integrations;
DROP POLICY IF EXISTS "Users can manage own facebook integrations" ON facebook_integrations;

CREATE POLICY "Users can view own facebook integrations" ON facebook_integrations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own facebook integrations" ON facebook_integrations
  FOR ALL USING (user_id = auth.uid());

-- ── slack_integrations ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own tenant slack integrations" ON slack_integrations;
DROP POLICY IF EXISTS "Users can manage own tenant slack integrations" ON slack_integrations;
DROP POLICY IF EXISTS "Users can view own slack integrations" ON slack_integrations;
DROP POLICY IF EXISTS "Users can manage own slack integrations" ON slack_integrations;

CREATE POLICY "Users can view own slack integrations" ON slack_integrations
  FOR SELECT USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage own slack integrations" ON slack_integrations
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

-- ── google_calendar_integrations ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own tenant google calendar integrations" ON google_calendar_integrations;
DROP POLICY IF EXISTS "Users can manage own tenant google calendar integrations" ON google_calendar_integrations;
DROP POLICY IF EXISTS "Users can view own google calendar integrations" ON google_calendar_integrations;
DROP POLICY IF EXISTS "Users can manage own google calendar integrations" ON google_calendar_integrations;

CREATE POLICY "Users can view own google calendar integrations" ON google_calendar_integrations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own google calendar integrations" ON google_calendar_integrations
  FOR ALL USING (user_id = auth.uid());

-- ── integrations (HubSpot, Zoho, Calendly, etc.) ────────────────────────────
DROP POLICY IF EXISTS "Users can view own tenant integrations" ON integrations;
DROP POLICY IF EXISTS "Users can manage own tenant integrations" ON integrations;
DROP POLICY IF EXISTS "Users can view own integrations" ON integrations;
DROP POLICY IF EXISTS "Users can manage own integrations" ON integrations;

CREATE POLICY "Users can view own integrations" ON integrations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own integrations" ON integrations
  FOR ALL USING (user_id = auth.uid());
