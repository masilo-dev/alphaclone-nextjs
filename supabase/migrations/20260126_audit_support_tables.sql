-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    read BOOLEAN DEFAULT FALSE,
    link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tenant_invitations table
CREATE TABLE IF NOT EXISTS tenant_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    token UUID DEFAULT uuid_generate_v4(),
    status TEXT DEFAULT 'pending', -- pending, accepted, expired
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    invited_by UUID REFERENCES auth.users(id)
);

-- Create security_scans table
CREATE TABLE IF NOT EXISTS security_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    score INTEGER,
    grade TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_scans ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Tenant admins can view invitations" ON tenant_invitations;
DROP POLICY IF EXISTS "Tenant admins can create invitations" ON tenant_invitations;
DROP POLICY IF EXISTS "Tenant users can view scans" ON security_scans;
DROP POLICY IF EXISTS "Tenant users can insert scans" ON security_scans;

-- Policies for notifications
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON notifications
    FOR INSERT WITH CHECK (true);

-- Policies for tenant_invitations
CREATE POLICY "Tenant admins can view invitations" ON tenant_invitations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM tenant_users tu
            WHERE tu.tenant_id = tenant_invitations.tenant_id
            AND tu.user_id = auth.uid()
            AND tu.role IN ('admin', 'owner')
        )
    );

CREATE POLICY "Tenant admins can create invitations" ON tenant_invitations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM tenant_users tu
            WHERE tu.tenant_id = tenant_invitations.tenant_id
            AND tu.user_id = auth.uid()
            AND tu.role IN ('admin', 'owner')
        )
    );

-- Policies for security_scans
CREATE POLICY "Tenant users can view scans" ON security_scans
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM tenant_users tu
            WHERE tu.tenant_id = security_scans.tenant_id
            AND tu.user_id = auth.uid()
        )
    );

CREATE POLICY "Tenant users can insert scans" ON security_scans
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM tenant_users tu
            WHERE tu.tenant_id = security_scans.tenant_id
            AND tu.user_id = auth.uid()
        )
    );
