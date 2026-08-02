import { MetadataRoute } from 'next';
import { getPublishedSeoArticles } from '@/services/seoServerService';
import { SITE_URL } from '@/lib/siteUrl';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = SITE_URL;

    // 1. Static Marketing Routes
    const highPriorityRoutes = ['', '/services', '/about', '/guide', '/docs', '/faq', '/pricing', '/contact', '/demo', '/book-demo', '/tools/ai-architect'].map((route) => ({
        url: `${baseUrl}${route}`,
        changeFrequency: 'weekly' as const,
        priority: route === '' ? 1.0 : (route === '/book-demo' || route === '/demo') ? 0.95 : route === '/tools/ai-architect' ? 0.8 : 0.9,
    }));

    const standardRoutes = [
        '/ecosystem',
        '/who-we-serve',
        '/blog',
        '/platform-status',
        '/legal',
        '/security-policy',
        '/compliance',
        '/crm',
        '/lead-management',
        '/project-management',
        '/ai-agents',
        '/video-meetings',
        '/marketing/email',
        '/marketing/automation',
        '/marketing/forms',
        '/marketing/sequences',
        '/solutions/solo-founders',
        '/solutions/agencies',
        '/solutions/consultants',
        '/results',
        '/claude-manus-integrations',
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        changeFrequency: 'monthly' as const,
        priority:
            route === '/legal' ||
            route === '/platform-status' ||
            route === '/crm' ||
            route === '/lead-management' ||
            route === '/project-management' ||
            route === '/ai-agents' ||
            route === '/video-meetings' ||
            route.startsWith('/marketing/') ||
            route.startsWith('/solutions/') ||
            route === '/results' ||
            route === '/claude-manus-integrations'
                ? 0.85
                : 0.7,
    }));

    const legalRoutes = [
        '/privacy-policy',
        '/terms-of-service',
        '/cookie-policy',
        '/data-deletion',
        '/sla',
        '/dpa',
        '/privacy-choices',
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
    }));

    // Note: /legal/privacy, /legal/terms, /legal/cookies, /legal/sla and
    // /legal/dpa now permanently redirect to the canonical docs above, so they
    // are intentionally excluded here to avoid indexing redirecting URLs.
    const newLegalRoutes = [
        '/legal/acceptable-use',
        '/legal/data-request',
        '/legal/refund',
        '/legal/ai-disclaimer',
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        changeFrequency: 'yearly' as const,
        priority: 0.3,
    }));

    const staticRoutes = [...highPriorityRoutes, ...standardRoutes, ...legalRoutes, ...newLegalRoutes];

    // 2. Dynamic Blog Routes
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

    return [...staticRoutes, ...blogRoutes];
}
