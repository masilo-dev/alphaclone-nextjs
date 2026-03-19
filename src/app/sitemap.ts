import { MetadataRoute } from 'next';
import { seoService } from '../services/seoService';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://alphaclone.tech'; // Updated domain

    // 1. Static Marketing Routes
    const highPriorityRoutes = ['', '/services', '/about', '/guide', '/docs', '/pricing', '/contact', '/auth/login'].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date('2026-03-05'),
        changeFrequency: 'weekly' as const,
        priority: route === '' ? 1.0 : route === '/auth/login' ? 0.8 : 0.9,
    }));

    const standardRoutes = [
        '/ecosystem',
        '/who-we-serve',
        '/blog',
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date('2026-03-05'),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
    }));

    const legalRoutes = [
        '/privacy-policy',
        '/terms-of-service',
        '/cookie-policy',
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date('2026-01-01'),
        changeFrequency: 'yearly' as const,
        priority: 0.3,
    }));

    const staticRoutes = [...highPriorityRoutes, ...standardRoutes, ...legalRoutes];

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
