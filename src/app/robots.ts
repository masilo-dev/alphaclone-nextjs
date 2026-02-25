import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    const baseUrl = 'https://alphaclone.tech';

    return {
        rules: [
            // Standard search engines — full access to marketing pages
            {
                userAgent: ['Googlebot', 'Googlebot-Image', 'Googlebot-Video'],
                allow: ['/'],
                disallow: ['/dashboard', '/api/', '/auth/', '/private-docs/', '/admin/'],
            },
            {
                userAgent: 'Bingbot',
                allow: ['/'],
                disallow: ['/dashboard', '/api/', '/auth/', '/private-docs/', '/admin/'],
            },

            // AI Answer Engines — explicitly allowed for citation indexing
            // These bots are allowed to read all marketing & documentation content
            // but must NOT index private user data routes
            {
                userAgent: 'GPTBot',
                allow: ['/', '/services', '/about', '/guide', '/docs', '/pricing', '/blog', '/ecosystem', '/who-we-serve', '/compare', '/contact', '/llms.txt'],
                disallow: ['/dashboard', '/api/', '/auth/', '/private-docs/', '/invoice/', '/project/', '/book/', '/meet/', '/call/'],
            },
            {
                userAgent: 'OAI-SearchBot',
                allow: ['/', '/services', '/about', '/guide', '/docs', '/pricing', '/blog', '/ecosystem', '/who-we-serve', '/compare', '/contact', '/llms.txt'],
                disallow: ['/dashboard', '/api/', '/auth/', '/private-docs/', '/invoice/', '/project/', '/book/', '/meet/', '/call/'],
            },
            {
                userAgent: 'PerplexityBot',
                allow: ['/', '/services', '/about', '/guide', '/docs', '/pricing', '/blog', '/ecosystem', '/who-we-serve', '/compare', '/contact', '/llms.txt'],
                disallow: ['/dashboard', '/api/', '/auth/', '/private-docs/', '/invoice/', '/project/', '/book/', '/meet/', '/call/'],
            },
            {
                userAgent: 'ClaudeBot',
                allow: ['/', '/services', '/about', '/guide', '/docs', '/pricing', '/blog', '/ecosystem', '/who-we-serve', '/compare', '/contact', '/llms.txt'],
                disallow: ['/dashboard', '/api/', '/auth/', '/private-docs/', '/invoice/', '/project/', '/book/', '/meet/', '/call/'],
            },
            {
                userAgent: 'anthropic-ai',
                allow: ['/', '/services', '/about', '/guide', '/docs', '/pricing', '/blog', '/ecosystem', '/who-we-serve', '/compare', '/contact', '/llms.txt'],
                disallow: ['/dashboard', '/api/', '/auth/', '/private-docs/'],
            },
            {
                userAgent: 'Applebot',
                allow: ['/'],
                disallow: ['/dashboard', '/api/', '/auth/', '/private-docs/'],
            },

            // General fallback — all other bots get full marketing access, no sensitive routes
            {
                userAgent: '*',
                allow: ['/'],
                disallow: ['/dashboard', '/api/', '/auth/', '/private-docs/', '/admin/'],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
        host: baseUrl,
    };
}
