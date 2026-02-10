import { MetadataRoute } from 'next';
import { seoService } from '../services/seoService';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://alphaclonesystems.com'; // Replace with actual domain

    // 1. Static Routes
    const staticRoutes = [
        '',
        '/about',
        '/services',
        '/portfolio',
        '/contact',
        '/blog',
        '/login',
        '/register',
        '/privacy-policy',
        '/terms-of-service',
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: route === '' ? 1 : 0.8,
    }));

    // 2. Dynamic Blog Routes
    let blogRoutes: MetadataRoute.Sitemap = [];
    try {
        const { articles } = await seoService.getPublishedArticles();
        blogRoutes = articles.map((article) => ({
            url: `${baseUrl}/blog/${article.slug}`,
            lastModified: new Date(article.updated_at || article.created_at),
            changeFrequency: 'weekly' as const,
            priority: 0.7,
        }));
    } catch (error) {
        console.error('Failed to generate blog sitemap:', error);
    }

    return [...staticRoutes, ...blogRoutes];
}
