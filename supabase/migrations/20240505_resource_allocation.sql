-- Resource Allocation Tables
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT,
    email TEXT,
    skills TEXT[] DEFAULT '{}',
    availability INTEGER DEFAULT 100,
    hourly_rate DECIMAL(12, 2) DEFAULT 0,
    current_projects TEXT[] DEFAULT '{}',
    max_projects INTEGER DEFAULT 3,
    status TEXT DEFAULT 'available',
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- human, equipment, software, budget
    description TEXT,
    capacity DECIMAL(12, 2) DEFAULT 0,
    used DECIMAL(12, 2) DEFAULT 0,
    unit TEXT DEFAULT 'hours',
    cost_per_unit DECIMAL(12, 2) DEFAULT 0,
    availability TEXT DEFAULT 'available',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_resources ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view team members of their tenant" ON team_members;
CREATE POLICY "Users can view team members of their tenant" ON team_members
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage team members of their tenant" ON team_members;
CREATE POLICY "Users can manage team members of their tenant" ON team_members
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND role IN ('admin', 'owner')));

DROP POLICY IF EXISTS "Users can view resources of their tenant" ON business_resources;
CREATE POLICY "Users can view resources of their tenant" ON business_resources
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage resources of their tenant" ON business_resources;
CREATE POLICY "Users can manage resources of their tenant" ON business_resources
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND role IN ('admin', 'owner')));

-- Storage Buckets
-- Run this in Supabase Dashboard or via API
-- INSERT INTO storage.buckets (id, name, public) VALUES ('project-images', 'project-images', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', false) ON CONFLICT DO NOTHING;
