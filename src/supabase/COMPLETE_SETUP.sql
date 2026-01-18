-- ============================================================================
-- COMPLETE SUPABASE SETUP - ALL MIGRATIONS IN ONE FILE
-- Run this file with: supabase db push --file COMPLETE_SETUP.sql
-- Or paste in Supabase Dashboard SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: SEO ARTICLES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.seo_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    meta_description TEXT NOT NULL,
    meta_keywords TEXT[],
    content TEXT NOT NULL,
    author TEXT DEFAULT 'AlphaClone Systems',
    category TEXT NOT NULL,
    tags TEXT[],
    published BOOLEAN DEFAULT TRUE,
    featured_image TEXT,
    reading_time INTEGER,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_seo_articles_slug ON public.seo_articles(slug);
CREATE INDEX IF NOT EXISTS idx_seo_articles_published ON public.seo_articles(published);
CREATE INDEX IF NOT EXISTS idx_seo_articles_category ON public.seo_articles(category);
CREATE INDEX IF NOT EXISTS idx_seo_articles_created_at ON public.seo_articles(created_at DESC);

-- RLS
ALTER TABLE public.seo_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view published articles" ON public.seo_articles;
CREATE POLICY "Anyone can view published articles"
    ON public.seo_articles FOR SELECT
    USING (published = true);

DROP POLICY IF EXISTS "Admins can manage articles" ON public.seo_articles;
CREATE POLICY "Admins can manage articles"
    ON public.seo_articles FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Functions
CREATE OR REPLACE FUNCTION calculate_reading_time()
RETURNS TRIGGER AS $$
BEGIN
    NEW.reading_time := CEIL(array_length(regexp_split_to_array(NEW.content, '\s+'), 1) / 200.0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_reading_time ON public.seo_articles;
CREATE TRIGGER update_reading_time
    BEFORE INSERT OR UPDATE ON public.seo_articles
    FOR EACH ROW
    EXECUTE FUNCTION calculate_reading_time();

DROP TRIGGER IF EXISTS update_seo_articles_updated_at ON public.seo_articles;
CREATE TRIGGER update_seo_articles_updated_at
    BEFORE UPDATE ON public.seo_articles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Complete setup finished!';
    RAISE NOTICE '📊 SEO articles table created';
    RAISE NOTICE '🔒 RLS policies active';
    RAISE NOTICE '⚡ Triggers configured';
    RAISE NOTICE '';
    RAISE NOTICE 'Next: Write articles in your admin dashboard!';
END $$;
