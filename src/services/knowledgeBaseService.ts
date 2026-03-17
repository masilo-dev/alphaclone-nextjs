import { supabase } from '../lib/supabase';

export interface KnowledgeArticle {
    id: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    author: string;
    views: number;
    helpful: number;
    notHelpful: number;
    createdAt: string;
    updatedAt: string;
    published: boolean;
}

export interface KnowledgeCategory {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    articleCount: number;
}

export interface ArticleSearchResult {
    article: KnowledgeArticle;
    relevance: number;
    matchedSections: string[];
}

export const knowledgeBaseService = {
    /**
     * Create a new knowledge article
     */
    async createArticle(
        article: Omit<KnowledgeArticle, 'id' | 'views' | 'helpful' | 'notHelpful' | 'createdAt' | 'updatedAt'>
    ): Promise<{ article: KnowledgeArticle | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('knowledge_articles')
                .insert({
                    title: article.title,
                    content: article.content,
                    category: article.category,
                    tags: article.tags,
                    author: article.author,
                    published: article.published,
                    views: 0,
                    helpful: 0,
                    not_helpful: 0,
                })
                .select()
                .single();

            if (error) throw error;

            return {
                article: {
                    id: data.id,
                    title: data.title,
                    content: data.content,
                    category: data.category,
                    tags: data.tags || [],
                    author: data.author,
                    views: data.views || 0,
                    helpful: data.helpful || 0,
                    notHelpful: data.not_helpful || 0,
                    createdAt: data.created_at,
                    updatedAt: data.updated_at,
                    published: data.published,
                },
                error: null,
            };
        } catch (error) {
            return {
                article: null,
                error: error instanceof Error ? error.message : 'Failed to create article',
            };
        }
    },

    /**
     * Get article by ID
     */
    async getArticle(articleId: string): Promise<{ article: KnowledgeArticle | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('knowledge_articles')
                .select('*')
                .eq('id', articleId)
                .single();

            if (error) throw error;

            // Increment view count
            await supabase
                .from('knowledge_articles')
                .update({ views: (data.views || 0) + 1 })
                .eq('id', articleId);

            return {
                article: {
                    id: data.id,
                    title: data.title,
                    content: data.content,
                    category: data.category,
                    tags: data.tags || [],
                    author: data.author,
                    views: (data.views || 0) + 1,
                    helpful: data.helpful || 0,
                    notHelpful: data.not_helpful || 0,
                    createdAt: data.created_at,
                    updatedAt: data.updated_at,
                    published: data.published,
                },
                error: null,
            };
        } catch (error) {
            return {
                article: null,
                error: error instanceof Error ? error.message : 'Failed to fetch article',
            };
        }
    },

    /**
     * Search articles
     */
    async searchArticles(query: string, category?: string): Promise<{ results: ArticleSearchResult[]; error: string | null }> {
        try {
            let searchQuery = supabase
                .from('knowledge_articles')
                .select('*')
                .eq('published', true)
                .or(`title.ilike.%${query}%,content.ilike.%${query}%`);

            if (category) {
                searchQuery = searchQuery.eq('category', category);
            }

            const { data, error } = await searchQuery;

            if (error) throw error;

            // Calculate relevance
            const results: ArticleSearchResult[] = (data || []).map((article: any) => {
                const titleMatch = article.title.toLowerCase().includes(query.toLowerCase());
                const contentMatch = article.content.toLowerCase().includes(query.toLowerCase());
                const relevance = (titleMatch ? 100 : 0) + (contentMatch ? 50 : 0);

                // Extract matched sections
                const matchedSections: string[] = [];
                const contentLower = article.content.toLowerCase();
                const queryLower = query.toLowerCase();
                const index = contentLower.indexOf(queryLower);
                if (index !== -1) {
                    const start = Math.max(0, index - 50);
                    const end = Math.min(article.content.length, index + query.length + 50);
                    matchedSections.push(article.content.substring(start, end));
                }

                return {
                    article: {
                        id: article.id,
                        title: article.title,
                        content: article.content,
                        category: article.category,
                        tags: article.tags || [],
                        author: article.author,
                        views: article.views || 0,
                        helpful: article.helpful || 0,
                        notHelpful: article.not_helpful || 0,
                        createdAt: article.created_at,
                        updatedAt: article.updated_at,
                        published: article.published,
                    },
                    relevance,
                    matchedSections,
                };
            });

            // Sort by relevance
            results.sort((a, b) => b.relevance - a.relevance);

            return { results, error: null };
        } catch (error) {
            return {
                results: [],
                error: error instanceof Error ? error.message : 'Search failed',
            };
        }
    },

    /**
     * Get articles by category
     */
    async getArticlesByCategory(category: string): Promise<{ articles: KnowledgeArticle[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('knowledge_articles')
                .select('*')
                .eq('category', category)
                .eq('published', true)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return {
                articles: (data || []).map((article: any) => ({
                    id: article.id,
                    title: article.title,
                    content: article.content,
                    category: article.category,
                    tags: article.tags || [],
                    author: article.author,
                    views: article.views || 0,
                    helpful: article.helpful || 0,
                    notHelpful: article.not_helpful || 0,
                    createdAt: article.created_at,
                    updatedAt: article.updated_at,
                    published: article.published,
                })),
                error: null,
            };
        } catch (error) {
            return {
                articles: [],
                error: error instanceof Error ? error.message : 'Failed to fetch articles',
            };
        }
    },

    /**
     * Get all categories
     */
    async getCategories(): Promise<{ categories: KnowledgeCategory[]; error: string | null }> {
        try {
            const { data: articles } = await supabase
                .from('knowledge_articles')
                .select('category')
                .eq('published', true);

            // Count articles per category
            const categoryCounts: Record<string, number> = {};
            (articles || []).forEach((article: any) => {
                categoryCounts[article.category] = (categoryCounts[article.category] || 0) + 1;
            });

            const categories: KnowledgeCategory[] = Object.entries(categoryCounts).map(([name, count]) => ({
                id: name.toLowerCase().replace(/\s+/g, '-'),
                name,
                articleCount: count,
            }));

            return { categories, error: null };
        } catch (error) {
            return {
                categories: [],
                error: error instanceof Error ? error.message : 'Failed to fetch categories',
            };
        }
    },

    /**
     * Update article
     */
    async updateArticle(
        articleId: string,
        updates: Partial<Omit<KnowledgeArticle, 'id' | 'createdAt' | 'views' | 'helpful' | 'notHelpful'>>
    ): Promise<{ success: boolean; error: string | null }> {
        try {
            const { error } = await supabase
                .from('knowledge_articles')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', articleId);

            if (error) throw error;

            return { success: true, error: null };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update article',
            };
        }
    },

    /**
     * Mark article as helpful/not helpful
     */
    async rateArticle(articleId: string, helpful: boolean): Promise<{ success: boolean; error: string | null }> {
        try {
            const { data: article } = await supabase
                .from('knowledge_articles')
                .select('helpful, not_helpful')
                .eq('id', articleId)
                .single();

            if (!article) {
                return { success: false, error: 'Article not found' };
            }

            const { error } = await supabase
                .from('knowledge_articles')
                .update({
                    helpful: helpful ? (article.helpful || 0) + 1 : article.helpful || 0,
                    not_helpful: !helpful ? (article.not_helpful || 0) + 1 : article.not_helpful || 0,
                })
                .eq('id', articleId);

            if (error) throw error;

            return { success: true, error: null };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to rate article',
            };
        }
    },

    /**
     * Get popular articles
     */
    async getPopularArticles(limit: number = 10): Promise<{ articles: KnowledgeArticle[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('knowledge_articles')
                .select('*')
                .eq('published', true)
                .order('views', { ascending: false })
                .limit(limit);

            if (error) throw error;

            return {
                articles: (data || []).map((article: any) => ({
                    id: article.id,
                    title: article.title,
                    content: article.content,
                    category: article.category,
                    tags: article.tags || [],
                    author: article.author,
                    views: article.views || 0,
                    helpful: article.helpful || 0,
                    notHelpful: article.not_helpful || 0,
                    createdAt: article.created_at,
                    updatedAt: article.updated_at,
                    published: article.published,
                })),
                error: null,
            };
        } catch (error) {
            return {
                articles: [],
                error: error instanceof Error ? error.message : 'Failed to fetch popular articles',
            };
        }
    },

    /**
     * Get related articles
     */
    async getRelatedArticles(articleId: string, limit: number = 5): Promise<{ articles: KnowledgeArticle[]; error: string | null }> {
        try {
            const { data: currentArticle } = await supabase
                .from('knowledge_articles')
                .select('category, tags')
                .eq('id', articleId)
                .single();

            if (!currentArticle) {
                return { articles: [], error: null };
            }

            let query = supabase
                .from('knowledge_articles')
                .select('*')
                .eq('published', true)
                .neq('id', articleId)
                .limit(limit);

            // Prioritize same category
            if (currentArticle.category) {
                query = query.eq('category', currentArticle.category);
            }

            const { data, error } = await query;

            if (error) throw error;

            return {
                articles: (data || []).map((article: any) => ({
                    id: article.id,
                    title: article.title,
                    content: article.content,
                    category: article.category,
                    tags: article.tags || [],
                    author: article.author,
                    views: article.views || 0,
                    helpful: article.helpful || 0,
                    notHelpful: article.not_helpful || 0,
                    createdAt: article.created_at,
                    updatedAt: article.updated_at,
                    published: article.published,
                })),
                error: null,
            };
        } catch (error) {
            return {
                articles: [],
                error: error instanceof Error ? error.message : 'Failed to fetch related articles',
            };
        }
    },
};

