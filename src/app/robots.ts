import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/siteUrl';

export default function robots(): MetadataRoute.Robots {
    const baseUrl = SITE_URL;

    return {
        rules: [
            // Standard search engines — full access to marketing pages
            {
                userAgent: ['Googlebot', 'Googlebot-Image', 'Googlebot-Video', 'Bingbot'],
                allow: ['/'],
                disallow: ['/dashboard', '/api/', '/api/mcp', '/api/mcp/', '/mcp', '/mcp/', '/auth/reset-password', '/private-docs/', '/admin/', '/invoice/', '/quote/', '/sign/', '/contract/', '/meet/', '/call/', '/share/', '/billing/', '/account/', '/form/', '/p/', '/bp/', '/portal/'],
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
                allow: ['/services', '/about', '/guide', '/search', '/onboarding/create-business', '/docs', '/faq', '/pricing', '/blog', '/ecosystem', '/who-we-serve', '/contact', '/tools/ai-architect', '/llms.txt', '/auth/login', '/legal', '/platform-status', '/security-policy', '/compliance', '/crm', '/lead-management', '/project-management', '/ai-agents', '/video-meetings', '/claude-manus-integrations', '/'],
                disallow: ['/dashboard', '/api/', '/api/mcp', '/api/mcp/', '/mcp', '/mcp/', '/auth/reset-password', '/private-docs/', '/invoice/', '/project/', '/book/', '/meet/', '/call/', '/quote/', '/sign/', '/contract/', '/share/', '/billing/', '/account/', '/form/', '/p/', '/bp/', '/portal/'],
            },

            // General fallback — all other bots get full marketing access, no sensitive routes
            {
                userAgent: '*',
                allow: ['/auth/login', '/guide', '/search', '/onboarding/create-business', '/legal', '/platform-status', '/security-policy', '/compliance', '/crm', '/lead-management', '/project-management', '/ai-agents', '/video-meetings', '/claude-manus-integrations', '/'],
                disallow: ['/dashboard', '/api/', '/api/mcp', '/api/mcp/', '/mcp', '/mcp/', '/auth/reset-password', '/private-docs/', '/admin/', '/invoice/', '/quote/', '/sign/', '/contract/', '/meet/', '/call/', '/share/', '/billing/', '/account/', '/form/', '/p/', '/bp/', '/portal/'],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
        host: baseUrl,
    };
}
