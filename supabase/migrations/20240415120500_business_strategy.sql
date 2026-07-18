-- Business Strategy & Brand Context Table
-- Stores monthly themes and brand guardrails for AI generation
CREATE TABLE IF NOT EXISTS business_strategy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    month INTEGER NOT NULL, -- 1-12
    year INTEGER NOT NULL,
    theme_title TEXT NOT NULL,
    focus_topics TEXT[] DEFAULT '{}',
    brand_voice TEXT DEFAULT 'Professional, authoritative, article-style',
    prohibited_elements TEXT[] DEFAULT '{"emojis", "hashtags in text", "informal jargon"}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, month, year)
);

-- Enable RLS
ALTER TABLE business_strategy ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Tenant users can manage their strategy" ON business_strategy;
CREATE POLICY "Tenant users can manage their strategy"
    ON business_strategy FOR ALL
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
        )
    );

-- AI assets are created here because this is the first active migration that references them.
CREATE TABLE IF NOT EXISTS public.generated_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    asset_type VARCHAR(50) NOT NULL CHECK (asset_type IN ('logo', 'image', 'content')),
    prompt TEXT NOT NULL,
    url TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    storage_path TEXT,
    bucket_id TEXT DEFAULT 'social-assets',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_assets_user ON public.generated_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_assets_created ON public.generated_assets(created_at DESC);
