-- Growth Agent Targets Table
CREATE TABLE IF NOT EXISTS growth_agent_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    industry TEXT,
    location TEXT,
    filters TEXT,
    automated_outreach BOOLEAN DEFAULT FALSE,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for growth_agent_targets
ALTER TABLE growth_agent_targets ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies for growth_agent_targets
-- Note: These policies assume the existence of a tenant_users table for access control
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'growth_agent_targets' AND policyname = 'Users can view their tenant''s growth agent targets') THEN
        CREATE POLICY "Users can view their tenant's growth agent targets" 
        ON growth_agent_targets FOR SELECT 
        USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'growth_agent_targets' AND policyname = 'Users can insert their tenant''s growth agent targets') THEN
        CREATE POLICY "Users can insert their tenant's growth agent targets" 
        ON growth_agent_targets FOR INSERT 
        WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'growth_agent_targets' AND policyname = 'Users can update their tenant''s growth agent targets') THEN
        CREATE POLICY "Users can update their tenant's growth agent targets" 
        ON growth_agent_targets FOR UPDATE 
        USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'growth_agent_targets' AND policyname = 'Users can delete their tenant''s growth agent targets') THEN
        CREATE POLICY "Users can delete their tenant's growth agent targets" 
        ON growth_agent_targets FOR DELETE 
        USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
    END IF;
END $$;

-- Document Hub Metadata Expansion
ALTER TABLE file_uploads 
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS ai_summary TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_growth_agent_targets_tenant ON growth_agent_targets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_tags ON file_uploads USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_file_uploads_category ON file_uploads(category);
