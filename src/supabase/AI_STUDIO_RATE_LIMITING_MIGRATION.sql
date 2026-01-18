-- =====================================================
-- AI STUDIO + RATE LIMITING MIGRATION
-- Purpose: Add AI generation capabilities with client rate limiting
-- Features: Logo/image/content generation, 3/day limit for clients
-- =====================================================

-- Create generation usage tracking table
CREATE TABLE IF NOT EXISTS public.generation_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    generation_type VARCHAR(50) NOT NULL, -- 'logo', 'image', 'content'
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_user_type_date UNIQUE(user_id, generation_type, date)
);

-- Indexes for generation_usage
CREATE INDEX IF NOT EXISTS idx_generation_usage_user_date ON public.generation_usage(user_id, date);
CREATE INDEX IF NOT EXISTS idx_generation_usage_type ON public.generation_usage(generation_type);
CREATE INDEX IF NOT EXISTS idx_generation_usage_user_type ON public.generation_usage(user_id, generation_type);

-- Create generated assets table
CREATE TABLE IF NOT EXISTS public.generated_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    asset_type VARCHAR(50) NOT NULL, -- 'logo', 'image', 'content'
    prompt TEXT NOT NULL,
    url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for generated_assets
CREATE INDEX IF NOT EXISTS idx_generated_assets_user ON public.generated_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_assets_type ON public.generated_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_generated_assets_created ON public.generated_assets(created_at DESC);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to check if user can generate (rate limit)
CREATE OR REPLACE FUNCTION public.check_generation_limit(
    p_user_id UUID,
    p_generation_type VARCHAR,
    p_user_role VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
    v_limit INTEGER := 3; -- Client limit
BEGIN
    -- Admin has unlimited access
    IF p_user_role = 'admin' THEN
        RETURN TRUE;
    END IF;

    -- Get today's count for this user and type
    SELECT COALESCE(count, 0) INTO v_count
    FROM public.generation_usage
    WHERE user_id = p_user_id
    AND generation_type = p_generation_type
    AND date = CURRENT_DATE;

    -- Check if under limit
    RETURN v_count < v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment generation count
CREATE OR REPLACE FUNCTION public.increment_generation_count(
    p_user_id UUID,
    p_generation_type VARCHAR
)
RETURNS INTEGER AS $$
DECLARE
    v_new_count INTEGER;
BEGIN
    -- Insert or update count for today
    INSERT INTO public.generation_usage (user_id, generation_type, date, count)
    VALUES (p_user_id, p_generation_type, CURRENT_DATE, 1)
    ON CONFLICT (user_id, generation_type, date)
    DO UPDATE SET
        count = generation_usage.count + 1,
        updated_at = NOW()
    RETURNING count INTO v_new_count;

    RETURN v_new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get remaining generations for user
CREATE OR REPLACE FUNCTION public.get_remaining_generations(
    p_user_id UUID,
    p_generation_type VARCHAR,
    p_user_role VARCHAR
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
    v_limit INTEGER := 3;
BEGIN
    -- Admin has unlimited
    IF p_user_role = 'admin' THEN
        RETURN 999;
    END IF;

    -- Get today's count
    SELECT COALESCE(count, 0) INTO v_count
    FROM public.generation_usage
    WHERE user_id = p_user_id
    AND generation_type = p_generation_type
    AND date = CURRENT_DATE;

    -- Return remaining
    RETURN GREATEST(0, v_limit - v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset daily limits (run via cron at midnight)
CREATE OR REPLACE FUNCTION public.cleanup_old_generation_usage()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Delete usage records older than 30 days
    DELETE FROM public.generation_usage
    WHERE date < CURRENT_DATE - INTERVAL '30 days';

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.generation_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_assets ENABLE ROW LEVEL SECURITY;

-- generation_usage policies
CREATE POLICY "Users can view own generation usage" ON public.generation_usage
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Users can insert own generation usage" ON public.generation_usage
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
    );

CREATE POLICY "Users can update own generation usage" ON public.generation_usage
    FOR UPDATE USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- generated_assets policies
CREATE POLICY "Users can view own generated assets" ON public.generated_assets
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Users can create own generated assets" ON public.generated_assets
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
    );

CREATE POLICY "Users can delete own generated assets" ON public.generated_assets
    FOR DELETE USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION public.check_generation_limit(UUID, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_generation_count(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_remaining_generations(UUID, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_generation_usage() TO authenticated;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Run these to verify migration:

-- 1. Check if tables exist
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('generation_usage', 'generated_assets');

-- 2. Test rate limit check (should return true for new user)
-- SELECT public.check_generation_limit(
--     '00000000-0000-0000-0000-000000000000'::UUID,
--     'logo',
--     'client'
-- );

-- 3. Test increment (should return 1)
-- SELECT public.increment_generation_count(
--     '00000000-0000-0000-0000-000000000000'::UUID,
--     'logo'
-- );

-- 4. Test get remaining (should return 2 after above increment)
-- SELECT public.get_remaining_generations(
--     '00000000-0000-0000-0000-000000000000'::UUID,
--     'logo',
--     'client'
-- );

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Summary:
-- ✅ generation_usage table - tracks daily usage per user/type
-- ✅ generated_assets table - stores generated content history
-- ✅ check_generation_limit() - validates if user can generate
-- ✅ increment_generation_count() - increments usage counter
-- ✅ get_remaining_generations() - gets remaining for today
-- ✅ cleanup_old_generation_usage() - cleanup old data
-- ✅ RLS policies for security
-- ✅ Indexes for performance

-- Rate Limits:
-- - Clients: 3 generations per day per type (logo, image, content)
-- - Admins: Unlimited
-- - Resets: Midnight every day
