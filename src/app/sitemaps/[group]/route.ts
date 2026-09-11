import { NextResponse } from 'next/server';
import { SEGMENTED_SITEMAPS } from '@/lib/seo/sitemapData';

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ group: string }> },
) {
  const { group } = await params;
  const sitemapName = group.replace(/\.xml$/, '') as keyof typeof SEGMENTED_SITEMAPS;
  const entries = SEGMENTED_SITEMAPS[sitemapName];

  if (!entries) {
    return new NextResponse('Sitemap not found', { status: 404 });
  }

  const urls = entries.map((item) => {
    const lastModified = item.lastModified
      ? new Date(item.lastModified).toISOString()
      : undefined;
    return [
      '  <url>',
      `    <loc>${escapeXml(item.url)}</loc>`,
      lastModified ? `    <lastmod>${lastModified}</lastmod>` : '',
      item.changeFrequency ? `    <changefreq>${item.changeFrequency}</changefreq>` : '',
      typeof item.priority === 'number' ? `    <priority>${item.priority}</priority>` : '',
      '  </url>',
    ].filter(Boolean).join('\n');
  }).join('\n');

  return new NextResponse(
    `${XML_HEADER}\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    },
  );
}

