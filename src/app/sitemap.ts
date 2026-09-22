import { MetadataRoute } from 'next';
import { getPublishedSeoArticles } from '@/services/seoServerService';
import { SITE_URL } from '@/lib/siteUrl';
import { STATIC_SITEMAP } from '@/lib/seo/sitemapData';
import { PUBLIC_INTEGRATIONS } from '@/config/integrations';

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

    const integrationRoutes: MetadataRoute.Sitemap = PUBLIC_INTEGRATIONS.map((integration) => ({
        url: `${baseUrl}/ecosystem/${integration.id}`,
        lastModified: new Date('2026-09-22T00:00:00.000Z'),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
    }));

    return [...STATIC_SITEMAP, ...integrationRoutes, ...blogRoutes];
}
