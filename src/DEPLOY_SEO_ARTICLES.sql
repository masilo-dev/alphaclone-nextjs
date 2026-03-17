-- SEO Articles Table (already exists, but ensuring it has the right structure)
-- This table stores articles that are ONLY for SEO, not displayed on landing page

CREATE TABLE IF NOT EXISTS public.seo_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    meta_description TEXT NOT NULL,
    meta_keywords TEXT[] DEFAULT '{}',
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    published BOOLEAN DEFAULT false,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for SEO
CREATE INDEX IF NOT EXISTS idx_seo_articles_slug ON public.seo_articles(slug);
CREATE INDEX IF NOT EXISTS idx_seo_articles_published ON public.seo_articles(published);
CREATE INDEX IF NOT EXISTS idx_seo_articles_category ON public.seo_articles(category);

-- Enable RLS
ALTER TABLE public.seo_articles ENABLE ROW LEVEL SECURITY;

-- Public can read published articles (for SEO crawlers)
DROP POLICY IF EXISTS "Anyone can view published SEO articles" ON public.seo_articles;
CREATE POLICY "Anyone can view published SEO articles"
    ON public.seo_articles FOR SELECT
    USING (published = true);

-- Only authenticated users can manage
DROP POLICY IF EXISTS "Authenticated users can manage SEO articles" ON public.seo_articles;
CREATE POLICY "Authenticated users can manage SEO articles"
    ON public.seo_articles FOR ALL
    USING (auth.role() = 'authenticated');

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_seo_article_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating timestamp
DROP TRIGGER IF EXISTS update_seo_article_timestamp ON public.seo_articles;
CREATE TRIGGER update_seo_article_timestamp
    BEFORE UPDATE ON public.seo_articles
    FOR EACH ROW
    EXECUTE FUNCTION update_seo_article_timestamp();

-- Sample SEO article categories for AlphaClone Systems
-- These are suggestions for your 50+ articles
COMMENT ON TABLE public.seo_articles IS 'SEO-only articles for search engine visibility. Not displayed on main landing page.';

-- Insert sample article structure (you can delete this after understanding)
INSERT INTO public.seo_articles (title, slug, meta_description, meta_keywords, content, category, tags, published)
VALUES (
    'Complete Guide to Custom Software Development in 2025',
    'custom-software-development-guide-2025',
    'Discover the latest trends, best practices, and technologies in custom software development. Expert insights from AlphaClone Systems.',
    ARRAY['custom software', 'software development', 'web development', 'mobile apps', 'AlphaClone'],
    '# Complete Guide to Custom Software Development in 2025

## Introduction
Custom software development has evolved significantly...

## Why Choose Custom Software?
- Tailored to your specific needs
- Scalable and flexible
- Competitive advantage

## Technologies We Use at AlphaClone Systems
- React & Next.js for web applications
- React Native for mobile apps
- Node.js & Python for backend
- Cloud infrastructure (AWS, Azure, GCP)

## Our Development Process
1. Discovery & Planning
2. Design & Prototyping
3. Development & Testing
4. Deployment & Support

## Contact AlphaClone Systems
Ready to build your custom software? Contact us today for a free consultation.',
    'Software Development',
    ARRAY['guide', 'tutorial', 'best practices'],
    true
) ON CONFLICT (slug) DO NOTHING;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'SEO Articles table ready! Create 50+ articles for maximum search engine visibility.';
    RAISE NOTICE 'Articles are accessible at: /blog/[slug] but hidden from landing page.';
END $$;
