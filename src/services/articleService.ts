import { supabase } from '../lib/supabase';

export interface Article {
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
}

export const articleService = {
    async getArticles() {
        try {
            const { data, error } = await supabase
                .from('seo_articles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { articles: data as Article[], error: null };
        } catch (err: any) {
            console.error('Error fetching articles:', err);
            return { articles: [], error: err.message };
        }
    },

    async saveArticle(article: Partial<Article>, isNew: boolean) {
        try {
            const slug = article.slug || article.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || '';
            const articleData = { ...article, slug };

            if (isNew) {
                const { data, error } = await supabase
                    .from('seo_articles')
                    .insert([articleData])
                    .select()
                    .single();

                if (error) throw error;
                return { article: data as Article, error: null };
            } else {
                const { data, error } = await supabase
                    .from('seo_articles')
                    .update(articleData)
                    .eq('id', article.id)
                    .select()
                    .single();

                if (error) throw error;
                return { article: data as Article, error: null };
            }
        } catch (err: any) {
            console.error('Error saving article:', err);
            return { article: null, error: err.message };
        }
    },

    async deleteArticle(id: string) {
        try {
            const { error } = await supabase
                .from('seo_articles')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { error: null };
        } catch (err: any) {
            console.error('Error deleting article:', err);
            return { error: err.message };
        }
    },

    async togglePublished(id: string, published: boolean) {
        try {
            const { error } = await supabase
                .from('seo_articles')
                .update({ published })
                .eq('id', id);

            if (error) throw error;
            return { error: null };
        } catch (err: any) {
            console.error('Error toggling article status:', err);
            return { error: err.message };
        }
    }
};
