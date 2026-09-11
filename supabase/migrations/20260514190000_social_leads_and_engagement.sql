-- Migration for Social Leads and Engagement
-- Path: supabase/migrations/20260514190000_social_leads_and_engagement.sql

-- 1. Create Social Leads Table
CREATE TABLE IF NOT EXISTS public.social_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- 'x', 'linkedin', 'facebook'
    external_user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    display_name TEXT,
    bio TEXT,
    location TEXT,
    profile_image_url TEXT,
    follower_count INTEGER,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'disqualified', 'converted')),
    lead_score INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    last_interaction_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, platform, external_user_id)
);

-- 2. Create Captured Content Table
CREATE TABLE IF NOT EXISTS public.captured_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    external_id TEXT NOT NULL,
    author_id TEXT,
    author_username TEXT,
    content TEXT NOT NULL,
    media_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
    published_at TIMESTAMPTZ,
    sentiment TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, platform, external_id)
);

-- 3. Create Social Interactions Log
CREATE TABLE IF NOT EXISTS public.social_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    interaction_type TEXT NOT NULL, -- 'post', 'reply', 'dm', 'like'
    external_id TEXT, -- ID of the post/message on the platform
    recipient_id TEXT,
    content TEXT,
    status TEXT DEFAULT 'completed',
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE public.social_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captured_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_interactions ENABLE ROW LEVEL SECURITY;

-- 5. Policies (Strict Tenant Isolation)
DROP POLICY IF EXISTS "tenant_users_manage_social_leads" ON public.social_leads;
CREATE POLICY "tenant_users_manage_social_leads" ON public.social_leads
FOR ALL TO authenticated USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
) WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "tenant_users_manage_captured_content" ON public.captured_content;
CREATE POLICY "tenant_users_manage_captured_content" ON public.captured_content
FOR ALL TO authenticated USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
) WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "tenant_users_manage_social_interactions" ON public.social_interactions;
CREATE POLICY "tenant_users_manage_social_interactions" ON public.social_interactions
FOR ALL TO authenticated USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
) WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_social_leads_tenant ON public.social_leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_social_leads_platform ON public.social_leads(platform);
CREATE INDEX IF NOT EXISTS idx_captured_content_tenant ON public.captured_content(tenant_id);
CREATE INDEX IF NOT EXISTS idx_social_interactions_tenant ON public.social_interactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_social_interactions_user ON public.social_interactions(user_id);

-- 7. Add x_post_id to social_posts if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'social_posts' AND COLUMN_NAME = 'x_post_id') THEN
        ALTER TABLE public.social_posts ADD COLUMN x_post_id TEXT;
    END IF;
END $$;
