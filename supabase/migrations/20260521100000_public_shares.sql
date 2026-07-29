-- Migration: Add public_shares table for temporary public document sharing (expires in 48 hours)
-- Created: 2026-05-21

CREATE TABLE IF NOT EXISTS public_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    bucket TEXT NOT NULL,
    original_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '48 hours'),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable Row Level Security
ALTER TABLE public_shares ENABLE ROW LEVEL SECURITY;

-- 1. Public Read Policy: Allow anyone (including anonymous users) to retrieve active public shares
CREATE POLICY anon_select_public_shares ON public_shares
    FOR SELECT
    USING (expires_at > NOW());

-- 2. Tenant Management Policy: Allow authenticated tenant users to insert, update, or delete shares for their tenant
CREATE POLICY manage_public_shares ON public_shares
    FOR ALL
    TO authenticated
    USING (tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    ));

-- Indexes for performance and expiration sweeps
<<<<<<< HEAD
CREATE INDEX IF NOT EXISTS idx_public_shares_tenant ON public_shares(tenant_id);
CREATE INDEX IF NOT EXISTS idx_public_shares_expires ON public_shares(expires_at);
=======
CREATE INDEX idx_public_shares_tenant ON public_shares(tenant_id);
CREATE INDEX idx_public_shares_expires ON public_shares(expires_at);
>>>>>>> origin/main
