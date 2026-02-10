import { supabase } from '../lib/supabase';

export interface SeoArticle {
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

export const seoService = {
    /**
     * Get all published articles for the blog listing page
     */
    async getPublishedArticles(): Promise<{ articles: SeoArticle[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('seo_articles')
                .select('id, title, slug, meta_description, category, tags, published, created_at, views')
                .eq('published', true)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return { articles: data as SeoArticle[], error: null };
        } catch (error: any) {
            console.error('Error fetching articles:', error);
            return { articles: [], error: error.message };
        }
    },

    /**
     * Get recent articles (limit)
     */
    async getRecentArticles(limit = 3): Promise<{ articles: SeoArticle[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('seo_articles')
                .select('id, title, slug, meta_description, category, published, created_at')
                .eq('published', true)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;

            return { articles: data as SeoArticle[], error: null };
        } catch (error: any) {
            console.error('Error fetching recent articles:', error);
            return { articles: [], error: error.message };
        }
    },

    /**
     * Get a single article by slug
     */
    async getArticleBySlug(slug: string): Promise<{ article: SeoArticle | null; error: string | null }> {
        try {
            // First increment view count (fire and forget)
            supabase.rpc('increment_article_views', { article_slug: slug }).catch(() => { });

            const { data, error } = await supabase
                .from('seo_articles')
                .select('*')
                .eq('slug', slug)
                .single();

            if (error) throw error;

            return { article: data as SeoArticle, error: null };
        } catch (error: any) {
            console.error('Error fetching article:', error);
            return { article: null, error: error.message };
        }
    },

    /**
     * Create a new article (Admin only)
     */
    async createArticle(article: Partial<SeoArticle>): Promise<{ article: SeoArticle | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('seo_articles')
                .insert([article])
                .select()
                .single();

            if (error) throw error;

            return { article: data as SeoArticle, error: null };
        } catch (error: any) {
            console.error('Error creating article:', error);
            return { article: null, error: error.message };
        }
    }
};
