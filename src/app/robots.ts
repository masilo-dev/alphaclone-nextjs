import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/siteUrl';

export default function robots(): MetadataRoute.Robots {
    const baseUrl = SITE_URL;

    return {
        rules: [
            // Standard search engines — full access to marketing pages
            {
                userAgent: ['Googlebot', 'Googlebot-Image', 'Googlebot-Video', 'Bingbot'],
                allow: ['/api/mcp/', '/api/mcp', '/'],
                disallow: ['/dashboard', '/api/', '/auth/reset-password', '/private-docs/', '/admin/'],
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
                allow: ['/api/mcp/', '/api/mcp', '/services', '/about', '/guide', '/docs', '/faq', '/pricing', '/blog', '/ecosystem', '/who-we-serve', '/contact', '/tools/ai-architect', '/llms.txt', '/auth/login', '/legal', '/platform-status', '/security-policy', '/compliance', '/crm', '/lead-management', '/project-management', '/ai-agents', '/video-meetings', '/claude-manus-integrations', '/'],
                disallow: ['/dashboard', '/api/', '/auth/reset-password', '/private-docs/', '/invoice/', '/project/', '/book/', '/meet/', '/call/'],
            },

            // General fallback — all other bots get full marketing access, no sensitive routes
            {
                userAgent: '*',
                allow: ['/api/mcp/', '/api/mcp', '/auth/login', '/legal', '/platform-status', '/security-policy', '/compliance', '/crm', '/lead-management', '/project-management', '/ai-agents', '/video-meetings', '/claude-manus-integrations', '/'],
                disallow: ['/dashboard', '/api/', '/auth/reset-password', '/private-docs/', '/admin/'],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
        host: baseUrl,
    };
}
