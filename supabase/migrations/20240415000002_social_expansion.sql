-- Social Bookmarks Table
-- Stores links to Facebook Groups, LinkedIn Profiles, etc.
CREATE TABLE IF NOT EXISTS social_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    platform VARCHAR(50) NOT NULL, -- 'facebook', 'linkedin', 'twitter', 'instagram', 'other'
    category VARCHAR(50) DEFAULT 'general', -- 'group', 'profile', 'competitor', 'influencer'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, url)
);

-- Enable RLS
ALTER TABLE social_bookmarks ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Tenant users can manage their bookmarks" ON social_bookmarks;
CREATE POLICY "Tenant users can manage their bookmarks"
    ON social_bookmarks FOR ALL
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
        )
    );

-- LinkedIn Watchlist Table
-- Specific targets for AI monitoring
CREATE TABLE IF NOT EXISTS social_watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    platform VARCHAR(50) NOT NULL,
    monitoring_frequency VARCHAR(20) DEFAULT 'daily', -- 'daily', 'weekly', 'manual'
    last_checked_at TIMESTAMPTZ,
    last_post_summary TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, url)
);

-- Enable RLS
ALTER TABLE social_watchlist ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Tenant users can manage their watchlist" ON social_watchlist;
CREATE POLICY "Tenant users can manage their watchlist"
    ON social_watchlist FOR ALL
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
        )
    );
