import { supabase } from '../lib/supabase';

/**
 * Generate sitemap.xml for SEO articles
 * Run this to create/update sitemap after publishing articles
 */
export async function generateSitemap(): Promise<string> {
    // Fetch all published articles
    const { data: articles, error } = await supabase
        .from('seo_articles')
        .select('slug, updated_at')
        .eq('published', true)
        .order('updated_at', { ascending: false });

    if (error || !articles) {
        console.error('Error fetching articles:', error);
        return '';
    }

    const baseUrl = 'https://alphaclone.tech'; // Your actual domain

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <!-- Homepage -->
    <url>
        <loc>${baseUrl}/</loc>
        <changefreq>weekly</changefreq>
        <priority>1.0</priority>
    </url>
    
    <!-- Blog Articles -->
    ${articles.map((article: { slug: string; updated_at: string }) => `
    <url>
        <loc>${baseUrl}/blog/${article.slug}</loc>
        <lastmod>${new Date(article.updated_at).toISOString()}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
    </url>`).join('')}
</urlset>`;

    return sitemap;
}

/**
 * Generate robots.txt
 */
export function generateRobotsTxt(): string {
    return `User-agent: *
Allow: /
Allow: /blog/

Sitemap: https://alphaclone.tech/sitemap.xml

# Disallow admin areas
Disallow: /dashboard/
Disallow: /admin/
`;
}

// Usage example:
// const sitemap = await generateSitemap();
// Save to public/sitemap.xml
