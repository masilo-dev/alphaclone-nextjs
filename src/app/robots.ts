import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/siteUrl';

export default function robots(): MetadataRoute.Robots {
    const baseUrl = SITE_URL;
    const privateRoutes = [
        '/dashboard', '/api/', '/api/mcp', '/api/mcp/', '/mcp', '/mcp/',
        '/auth/reset-password', '/private-docs/', '/admin/', '/invoice/', '/project/',
        '/quote/', '/sign/', '/contract/', '/meet/', '/call/', '/share/', '/billing/',
        '/account/', '/form/', '/p/', '/bp/', '/portal/',
    ];

    return {
        rules: [
            // Standard search engines — full access to marketing pages
            {
                userAgent: ['Googlebot', 'Googlebot-Image', 'Googlebot-Video', 'Bingbot'],
                allow: ['/'],
                disallow: privateRoutes,
            },

            // AI Answer Engines — explicitly allowed for citation indexing
            // These bots are allowed to read all marketing & documentation content
            // but must NOT index private user data routes
            {
                userAgent: [
                    'GPTBot',
                    'OAI-SearchBot',
                    'PerplexityBot',
                    'ClaudeBot',
                    'anthropic-ai',
                    'Applebot',
                    'Google-Extended',
                    'deepseek-ai',
                    'DeepSeekBot',
                    'Meta-ExternalAgent',
                    'YouBot',
                    'cohere-ai',
                    'BytesSpider'
                ],
                allow: ['/'],
                disallow: privateRoutes,
            },

            // General fallback — all other bots get full marketing access, no sensitive routes
            {
                userAgent: '*',
                allow: ['/'],
                disallow: privateRoutes,
            },
        ],
        sitemap: [
            `${baseUrl}/sitemap.xml`,
            `${baseUrl}/sitemaps/marketing.xml`,
            `${baseUrl}/sitemaps/solutions.xml`,
            `${baseUrl}/sitemaps/resources.xml`,
            `${baseUrl}/sitemaps/company.xml`,
        ],
        host: baseUrl,
    };
}
