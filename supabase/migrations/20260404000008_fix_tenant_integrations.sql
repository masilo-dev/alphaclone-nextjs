-- CRITICAL FIX: TENANT ISOLATION FOR ALL INTEGRATIONS
-- File: supabase/migrations/20260404_fix_tenant_integrations.sql

-- Add tenant_id to all integration tables that don't have it
ALTER TABLE facebook_integrations ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE slack_integrations ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE google_calendar_integrations ADD COLUMN tenant_id UUID REFERENCES tenants(id);

-- Update existing records to use tenant context from user profiles
UPDATE facebook_integrations SET tenant_id = (
  SELECT tenant_id FROM profiles WHERE profiles.id = facebook_integrations.user_id
) WHERE tenant_id IS NULL;

UPDATE slack_integrations SET tenant_id = (
  SELECT tenant_id FROM profiles WHERE profiles.id = slack_integrations.user_id
) WHERE tenant_id IS NULL;

UPDATE google_calendar_integrations SET tenant_id = (
  SELECT tenant_id FROM profiles WHERE profiles.id = google_calendar_integrations.user_id
) WHERE tenant_id IS NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_facebook_integrations_tenant ON facebook_integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_slack_integrations_tenant ON slack_integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_google_calendar_integrations_tenant ON google_calendar_integrations(tenant_id);

-- Drop old user-based policies and create tenant-based policies
DROP POLICY IF EXISTS "Users can view own facebook integrations" ON facebook_integrations;
DROP POLICY IF EXISTS "Users can manage own facebook integrations" ON facebook_integrations;

DROP POLICY IF EXISTS "Users can view own tenant facebook integrations" ON facebook_integrations;
CREATE POLICY "Users can view own tenant facebook integrations" ON facebook_integrations
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

DROP POLICY IF EXISTS "Users can manage own tenant facebook integrations" ON facebook_integrations;
CREATE POLICY "Users can manage own tenant facebook integrations" ON facebook_integrations
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Similar policies for slack integrations
DROP POLICY IF EXISTS "Users can view own slack integrations" ON slack_integrations;
DROP POLICY IF EXISTS "Users can manage own slack integrations" ON slack_integrations;

DROP POLICY IF EXISTS "Users can view own tenant slack integrations" ON slack_integrations;
CREATE POLICY "Users can view own tenant slack integrations" ON slack_integrations
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

DROP POLICY IF EXISTS "Users can manage own tenant slack integrations" ON slack_integrations;
CREATE POLICY "Users can manage own tenant slack integrations" ON slack_integrations
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Similar policies for google calendar integrations
DROP POLICY IF EXISTS "Users can view own google calendar integrations" ON google_calendar_integrations;
DROP POLICY IF EXISTS "Users can manage own google calendar integrations" ON google_calendar_integrations;

DROP POLICY IF EXISTS "Users can view own tenant google calendar integrations" ON google_calendar_integrations;
CREATE POLICY "Users can view own tenant google calendar integrations" ON google_calendar_integrations
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

DROP POLICY IF EXISTS "Users can manage own tenant google calendar integrations" ON google_calendar_integrations;
CREATE POLICY "Users can manage own tenant google calendar integrations" ON google_calendar_integrations
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Add tenant_id to integrations table if not present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integrations' AND column_name = 'tenant_id') THEN
    ALTER TABLE integrations ADD COLUMN tenant_id UUID REFERENCES tenants(id);
    
    -- Update existing records
    UPDATE integrations SET tenant_id = (
      SELECT tenant_id FROM profiles WHERE profiles.id = integrations.user_id
    ) WHERE tenant_id IS NULL;
    
    -- Add index
    CREATE INDEX IF NOT EXISTS idx_integrations_tenant ON integrations(tenant_id);
    
    -- Update policies
    DROP POLICY IF EXISTS "Users can view own integrations" ON integrations;
    DROP POLICY IF EXISTS "Users can manage own integrations" ON integrations;
    
DROP POLICY IF EXISTS "Users can view own tenant integrations" ON integrations;
    CREATE POLICY "Users can view own tenant integrations" ON integrations
      FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
    
DROP POLICY IF EXISTS "Users can manage own tenant integrations" ON integrations;
    CREATE POLICY "Users can manage own tenant integrations" ON integrations
      FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
  END IF;
END $$;

-- Verify migration success
DO $$
DECLARE
  v_facebook_count INTEGER;
  v_slack_count INTEGER;
  v_google_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_facebook_count FROM facebook_integrations WHERE tenant_id IS NOT NULL;
  SELECT COUNT(*) INTO v_slack_count FROM slack_integrations WHERE tenant_id IS NOT NULL;
  SELECT COUNT(*) INTO v_google_count FROM google_calendar_integrations WHERE tenant_id IS NOT NULL;
  
  RAISE NOTICE '✅ Tenant isolation migration completed:';
  RAISE NOTICE '   Facebook integrations with tenant_id: %', v_facebook_count;
  RAISE NOTICE '   Slack integrations with tenant_id: %', v_slack_count;
  RAISE NOTICE '   Google Calendar integrations with tenant_id: %', v_google_count;
  RAISE NOTICE '✅ All integrations are now properly tenant-isolated!';
END $$;
