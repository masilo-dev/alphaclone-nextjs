-- =====================================================
-- AI TASK AUTOMATION (RECURRING PROMPTS)
-- =====================================================

CREATE TABLE IF NOT EXISTS scheduled_ai_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    prompt TEXT NOT NULL,
    schedule TEXT NOT NULL, -- Cron or Natural Language
    timezone VARCHAR(50) DEFAULT 'UTC',
    notification_preference JSONB DEFAULT '{"email": true}',
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'paused'
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scheduled_ai_task_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES scheduled_ai_tasks(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    output TEXT,
    status VARCHAR(20), -- 'success', 'failure'
    error TEXT,
    ran_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE scheduled_ai_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_ai_task_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_access_tasks ON scheduled_ai_tasks
    FOR ALL USING (tenant_id = (SELECT current_setting('app.current_tenant_id')::UUID));

CREATE POLICY tenant_access_results ON scheduled_ai_task_results
    FOR ALL USING (tenant_id = (SELECT current_setting('app.current_tenant_id')::UUID));

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_scheduled_ai_tasks_updated_at
    BEFORE UPDATE ON scheduled_ai_tasks
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
