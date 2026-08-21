import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/siteUrl';

type SitemapEntry = MetadataRoute.Sitemap[number];

const CONTENT_RELEASE_DATE = '2026-08-21';

function entry(
  path: string,
  changeFrequency: SitemapEntry['changeFrequency'],
  priority: number,
  lastModified: string = CONTENT_RELEASE_DATE,
): SitemapEntry {
  return {
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  };
}

export const MARKETING_SITEMAP: MetadataRoute.Sitemap = [
  entry('', 'weekly', 1),
  entry('/services', 'monthly', 0.9),
  entry('/pricing', 'monthly', 0.9),
  entry('/crm', 'monthly', 0.85),
  entry('/lead-management', 'monthly', 0.85),
  entry('/project-management', 'monthly', 0.85),
  entry('/ai-agents', 'monthly', 0.85),
  entry('/video-meetings', 'monthly', 0.8),
  entry('/marketing/email', 'monthly', 0.8),
  entry('/marketing/automation', 'monthly', 0.8),
  entry('/marketing/forms', 'monthly', 0.8),
  entry('/marketing/sequences', 'monthly', 0.8),
  entry('/claude-manus-integrations', 'monthly', 0.8),
  entry('/ecosystem', 'monthly', 0.8),
  entry('/results', 'monthly', 0.8),
];

export const SOLUTIONS_SITEMAP: MetadataRoute.Sitemap = [
  entry('/who-we-serve', 'monthly', 0.85),
  entry('/solutions/solo-founders', 'monthly', 0.8),
  entry('/solutions/agencies', 'monthly', 0.8),
  entry('/solutions/consultants', 'monthly', 0.8),
];

export const RESOURCES_SITEMAP: MetadataRoute.Sitemap = [
  entry('/docs', 'weekly', 0.9),
  entry('/guide', 'monthly', 0.85),
  entry('/blog', 'weekly', 0.8),
  entry('/faq', 'monthly', 0.8),
  entry('/book-demo', 'monthly', 0.9),
  entry('/demo', 'monthly', 0.85),
  entry('/contact', 'monthly', 0.8),
  entry('/tools/ai-architect', 'monthly', 0.75),
];

export const COMPANY_SITEMAP: MetadataRoute.Sitemap = [
  entry('/about', 'monthly', 0.9),
  entry('/legal', 'monthly', 0.8),
  entry('/platform-status', 'weekly', 0.75),
  entry('/security-policy', 'monthly', 0.75),
  entry('/privacy-policy', 'yearly', 0.6),
  entry('/terms-of-service', 'yearly', 0.6),
  entry('/cookie-policy', 'yearly', 0.6),
  entry('/data-deletion', 'yearly', 0.5),
  entry('/sla', 'yearly', 0.5),
  entry('/dpa', 'yearly', 0.6),
  entry('/privacy-choices', 'yearly', 0.5),
  entry('/legal/acceptable-use', 'yearly', 0.4),
  entry('/legal/data-request', 'yearly', 0.4),
  entry('/legal/refund', 'yearly', 0.4),
  entry('/legal/ai-disclaimer', 'yearly', 0.4),
];

export const STATIC_SITEMAP: MetadataRoute.Sitemap = [
  ...MARKETING_SITEMAP,
  ...SOLUTIONS_SITEMAP,
  ...RESOURCES_SITEMAP,
  ...COMPANY_SITEMAP,
];

export const SEGMENTED_SITEMAPS = {
  marketing: MARKETING_SITEMAP,
  solutions: SOLUTIONS_SITEMAP,
  resources: RESOURCES_SITEMAP,
  company: COMPANY_SITEMAP,
} as const;

