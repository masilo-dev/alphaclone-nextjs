import 'server-only';

import { load } from 'cheerio';
import { normalizeEmail } from '@/lib/lead-finder/core';
import { RobotsTxtGuard } from 'robots-txt-guard';
import { fetchPublicPage, validateCrawlUrl } from './publicWebFetch';

const MAX_BYTES = 1_500_000;
const DEFAULT_PATHS = ['/', '/contact', '/contact-us', '/about', '/about-us', '/company', '/team', '/our-team', '/services'];

export function extractPublicEmails(html: string, sourceUrl: string) {
  const $ = load(html);
  const candidates = new Set<string>();
  $('a[href^="mailto:"]').each((_, el) => candidates.add(($(el).attr('href') || '').slice(7).split('?')[0]));
  const text = `${$.text()} ${$('script[type="application/ld+json"]').text()}`;
  for (const match of text.matchAll(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) candidates.add(match[0]);
  return [...candidates].map(normalizeEmail).filter((email): email is string => Boolean(email)).map((email) => ({
    email, source_url: sourceUrl, source_type: 'public_website', confidence: 90, verification_status: 'publicly_published' as const,
  }));
}

export function analyzeWebsiteQuality(html: string, url: string, responseBytes = 0) {
  const $ = load(html); const problems: string[] = [];
  if (!url.startsWith('https://')) problems.push('https_missing');
  if (!$('meta[name="viewport"]').attr('content')) problems.push('responsive_viewport_missing');
  if (!$('title').text().trim()) problems.push('title_missing');
  if (!$('meta[name="description"]').attr('content')) problems.push('missing_meta_description');
  if (!$('script[type="application/ld+json"]').length) problems.push('structured_data_missing');
  if (!$('link[rel*="icon"]').length) problems.push('favicon_missing');
  if (!$('a[href^="mailto:"], a[href^="tel:"], a[href*="contact"]').length) problems.push('no_visible_contact_cta');
  const years = [...$.text().matchAll(/(?:©|copyright)\s*(?:19|20)\d{2}/gi)].map((x) => Number(x[0].match(/\d{4}/)?.[0]));
  if (years.length && Math.max(...years) < new Date().getUTCFullYear() - 2) problems.push('outdated_copyright');
  if (/lorem ipsum|coming soon|website under construction/i.test($.text())) problems.push('placeholder_content');
  if (responseBytes > 1_000_000) problems.push('heavy_page');
  const websiteQualityScore = Math.max(0, 100 - problems.length * 11);
  return { website_quality_score: websiteQualityScore, opportunity_score: 100 - websiteQualityScore, problems };
}

export async function crawlPublicWebsite(value: string, options: { maxPages?: number } = {}) {
  const root = validateCrawlUrl(value); const maxPages = Math.max(1, Math.min(options.maxPages || 6, 8));
  const pages: Array<{ url: string; html: string; bytes: number }> = [];
  const robots = await fetchPublicPage(new URL('/robots.txt', root).href, 256_000, 5000);
  if (robots.status !== 200 && robots.status !== 404 && robots.status !== 410) throw new Error('CRAWL_ROBOTS_UNAVAILABLE');
  const guard = new RobotsTxtGuard(robots.status === 200 ? robots.body : '');
  const queue = DEFAULT_PATHS.map(path => ({ url: new URL(path, root), depth: 1 }));
  const visited = new Set<string>(); const deadline = Date.now() + 45_000;
  for (let index = 0; index < queue.length && visited.size < maxPages && Date.now() < deadline; index++) {
    const { url, depth } = queue[index];
    if (visited.has(url.href) || !guard.isAllowed('AlphaCloneBot', url.pathname)) continue;
    visited.add(url.href);
    try {
      const res = await fetchPublicPage(url.href, MAX_BYTES);
      if (res.status !== 200 || !res.contentType.includes('text/html')) continue;
      const html = res.body; pages.push({ url: url.href, html, bytes: res.bytes });
      if (depth < 2) {
        const $ = load(html);
        const links: Array<{ url: URL; depth: number }> = [];
        $('a[href]').each((_, element) => {
          try {
            const target = new URL($(element).attr('href')!, url);
            if (target.origin === root.origin && /contact|about|company|team|services/i.test(target.pathname)) {
              target.hash = ''; target.search = ''; links.push({ url: target, depth: depth + 1 });
            }
          } catch { /* malformed link */ }
        });
        queue.splice(index + 1, 0, ...links.slice(0, maxPages));
      }
    } catch { /* provider isolation: an inaccessible page is not a search failure */ }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  const emails = pages.flatMap((page) => extractPublicEmails(page.html, page.url));
  const first = pages[0];
  return { pages_crawled: pages.length, emails: [...new Map(emails.map((x) => [x.email, x])).values()], quality: first ? analyzeWebsiteQuality(first.html, first.url, first.bytes) : null };
}
