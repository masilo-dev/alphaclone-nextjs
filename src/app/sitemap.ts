import { MetadataRoute } from 'next';
import { getPublishedSeoArticles } from '@/services/seoServerService';
import { SITE_URL } from '@/lib/siteUrl';
import { STATIC_SITEMAP } from '@/lib/seo/sitemapData';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = SITE_URL;
    // Dynamic blog routes keep their real publication/update timestamps.
    let blogRoutes: MetadataRoute.Sitemap = [];
    try {
        const articles = await getPublishedSeoArticles();
        blogRoutes = Array.isArray(articles) ? articles.map((article) => ({
            url: `${baseUrl}/blog/${article.slug}`,
            lastModified: new Date(article.updated_at || article.created_at),
            changeFrequency: 'weekly' as const,
            priority: 0.7,
        })) : [];
    } catch (error) {
        console.error('Failed to generate blog sitemap:', error);
    }

    return [...STATIC_SITEMAP, ...blogRoutes];
}
