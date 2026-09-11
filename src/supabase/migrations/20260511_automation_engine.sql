-- =====================================================
-- AUTOMATION ENGINE TABLES
-- =====================================================

-- 1. Business Automation Events (The Trigger Queue)
CREATE TABLE IF NOT EXISTS business_automation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB DEFAULT '{}',
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bus_events_unprocessed ON business_automation_events(processed, created_at) 
WHERE processed = false;

-- 2. Cron Logs (Audit Trail for Schedulers)
CREATE TABLE IF NOT EXISTS automation_cron_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_type VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'success', 'failed'
    payload JSONB DEFAULT '{}',
    ran_at TIMESTAMPTZ DEFAULT NOW(),
    error_message TEXT
);

-- 3. Automation Runs (Workflow Instance Tracking)
CREATE TABLE IF NOT EXISTS automation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_type VARCHAR(100) NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'running', -- 'running', 'completed', 'failed', 'retrying'
    steps JSONB DEFAULT '[]', -- Array of step results
    error TEXT,
    retries INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_runs_tenant ON automation_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_auto_runs_status ON automation_runs(status);

-- 4. PWA Push Subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    keys JSONB NOT NULL, -- { p256dh, auth }
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE business_automation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_cron_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Automation events and runs are mostly system-level, but tenants should see their own
CREATE POLICY tenant_view_auto_events ON business_automation_events
    FOR SELECT USING (tenant_id = (SELECT current_setting('app.current_tenant_id')::UUID));

CREATE POLICY tenant_view_auto_runs ON automation_runs
    FOR SELECT USING (tenant_id = (SELECT current_setting('app.current_tenant_id')::UUID));

-- Users manage their own push subscriptions
CREATE POLICY user_manage_push_subs ON push_subscriptions
    FOR ALL USING (user_id = auth.uid());
