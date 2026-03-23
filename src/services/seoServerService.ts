import { createSupabaseAdminClient } from '@/lib/supabase-server';

export interface SeoArticleRecord {
    id: string;
    title: string;
    slug: string;
    meta_description: string;
    meta_keywords: string[];
    content: string;
    category: string;
    tags: string[];
    published: boolean;
    views: number;
    created_at: string;
    updated_at: string;
}

export async function getPublishedSeoArticles() {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
        .from('seo_articles')
        .select('id, title, slug, meta_description, meta_keywords, category, tags, published, views, created_at, updated_at')
        .eq('published', true)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as SeoArticleRecord[];
}

export async function getPublishedSeoArticleBySlug(slug: string) {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
        .from('seo_articles')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle();

    if (error) throw error;
    return (data || null) as SeoArticleRecord | null;
}
