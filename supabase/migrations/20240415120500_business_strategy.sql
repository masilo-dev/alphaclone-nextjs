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

-- Add AI Storage Bucket support metadata to generated_assets
-- This is just for tracking, the actual file will be in Supabase Storage
ALTER TABLE generated_assets ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE generated_assets ADD COLUMN IF NOT EXISTS bucket_id TEXT DEFAULT 'social-assets';
