import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
    SEO_ARTICLE_FALLBACKS,
    SEO_ARTICLE_FALLBACK_BY_SLUG,
} from '@/content/seoArticleFallbacks';

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

const SEO_QUERY_TIMEOUT_MS = 3500;

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs = SEO_QUERY_TIMEOUT_MS): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            Promise.resolve(promise),
            new Promise<T>((_, reject) => {
                timer = setTimeout(() => reject(new Error(`SEO article query timed out after ${timeoutMs}ms`)), timeoutMs);
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

export async function getPublishedSeoArticles() {
    try {
        const supabase = createSupabaseAdminClient();
        const { data, error } = await withTimeout(
            supabase
                .from('seo_articles')
                .select('id, title, slug, meta_description, meta_keywords, category, tags, published, views, created_at, updated_at')
                .eq('published', true)
                .order('created_at', { ascending: false }),
        );
        if (error) throw error;
        return Array.isArray(data) && data.length > 0
            ? (data as SeoArticleRecord[])
            : SEO_ARTICLE_FALLBACKS;
    } catch (error) {
        console.error('Published SEO articles unavailable; using local seeded fallbacks.', error);
        return SEO_ARTICLE_FALLBACKS;
    }
}

export async function getPublishedSeoArticleBySlug(slug: string) {
    const fallback = SEO_ARTICLE_FALLBACK_BY_SLUG.get(slug) || null;
    try {
        const supabase = createSupabaseAdminClient();
        const { data, error } = await withTimeout(
            supabase
                .from('seo_articles')
                .select('*')
                .eq('slug', slug)
                .eq('published', true)
                .maybeSingle(),
        );
        if (error) throw error;
        return (data || fallback) as SeoArticleRecord | null;
    } catch (error) {
        console.error(`SEO article "${slug}" unavailable; using local seeded fallback.`, error);
        return fallback;
    }
}
