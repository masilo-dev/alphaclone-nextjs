import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com').replace(/\/$/, '');

    return {
        rules: [
            // Standard search engines — full access to marketing pages
            {
                userAgent: ['Googlebot', 'Googlebot-Image', 'Googlebot-Video', 'Bingbot'],
                allow: ['/'],
                disallow: ['/dashboard', '/api/', '/auth/reset-password', '/private-docs/', '/admin/'],
            },

            // AI Answer Engines — explicitly allowed for citation indexing
            // These bots are allowed to read all marketing & documentation content
            // but must NOT index private user data routes
            {
                userAgent: 'GPTBot',
                allow: ['/', '/services', '/about', '/guide', '/docs', '/pricing', '/blog', '/ecosystem', '/who-we-serve', '/contact', '/tools/ai-architect', '/llms.txt', '/auth/login', '/legal', '/platform-status', '/security-policy', '/compliance', '/crm', '/lead-management', '/project-management', '/ai-agents', '/video-meetings', '/claude-manus-integrations'],
                disallow: ['/dashboard', '/api/', '/auth/reset-password', '/private-docs/', '/invoice/', '/project/', '/book/', '/meet/', '/call/'],
            },
            {
                userAgent: 'OAI-SearchBot',
                allow: ['/', '/services', '/about', '/guide', '/docs', '/pricing', '/blog', '/ecosystem', '/who-we-serve', '/contact', '/tools/ai-architect', '/llms.txt', '/auth/login', '/legal', '/platform-status', '/security-policy', '/compliance', '/crm', '/lead-management', '/project-management', '/ai-agents', '/video-meetings', '/claude-manus-integrations'],
                disallow: ['/dashboard', '/api/', '/auth/reset-password', '/private-docs/', '/invoice/', '/project/', '/book/', '/meet/', '/call/'],
            },
            {
                userAgent: 'PerplexityBot',
                allow: ['/', '/services', '/about', '/guide', '/docs', '/pricing', '/blog', '/ecosystem', '/who-we-serve', '/contact', '/tools/ai-architect', '/llms.txt', '/auth/login', '/legal', '/platform-status', '/security-policy', '/compliance', '/crm', '/lead-management', '/project-management', '/ai-agents', '/video-meetings', '/claude-manus-integrations'],
                disallow: ['/dashboard', '/api/', '/auth/reset-password', '/private-docs/', '/invoice/', '/project/', '/book/', '/meet/', '/call/'],
            },
            {
                userAgent: 'ClaudeBot',
                allow: ['/', '/services', '/about', '/guide', '/docs', '/pricing', '/blog', '/ecosystem', '/who-we-serve', '/contact', '/tools/ai-architect', '/llms.txt', '/auth/login', '/legal', '/platform-status', '/security-policy', '/compliance', '/crm', '/lead-management', '/project-management', '/ai-agents', '/video-meetings', '/claude-manus-integrations'],
                disallow: ['/dashboard', '/api/', '/auth/reset-password', '/private-docs/', '/invoice/', '/project/', '/book/', '/meet/', '/call/'],
            },
            {
                userAgent: 'anthropic-ai',
                allow: ['/', '/services', '/about', '/guide', '/docs', '/pricing', '/blog', '/ecosystem', '/who-we-serve', '/contact', '/tools/ai-architect', '/llms.txt', '/auth/login', '/legal', '/platform-status', '/security-policy', '/compliance', '/crm', '/lead-management', '/project-management', '/ai-agents', '/video-meetings', '/claude-manus-integrations'],
                disallow: ['/dashboard', '/api/', '/auth/reset-password', '/private-docs/'],
            },
            {
                userAgent: 'Applebot',
                allow: ['/', '/auth/login', '/legal', '/platform-status', '/security-policy', '/compliance', '/crm', '/lead-management', '/project-management', '/ai-agents', '/video-meetings', '/claude-manus-integrations'],
                disallow: ['/dashboard', '/api/', '/auth/reset-password', '/private-docs/'],
            },

            // General fallback — all other bots get full marketing access, no sensitive routes
            {
                userAgent: '*',
                allow: ['/', '/auth/login', '/legal', '/platform-status', '/security-policy', '/compliance', '/crm', '/lead-management', '/project-management', '/ai-agents', '/video-meetings', '/claude-manus-integrations'],
                disallow: ['/dashboard', '/api/', '/auth/reset-password', '/private-docs/', '/admin/'],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
        host: baseUrl,
    };
}
