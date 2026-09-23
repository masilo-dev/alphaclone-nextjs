/**
 * Client for communicating with the Railway Scrapy Research microservice
 * with seamless in-process fallback when the microservice is offline or unconfigured.
 */

import { callScraperService } from '@/lib/scraper/scraperServiceClient';
import { crawlPublicWebsite } from '@/lib/lead-finder/websiteCrawler';
import { validateSafeUrl, sanitizeUntrustedContent } from './security';
import { normalizeDomain, normalizeEmail, normalizePhone, cleanSocialUrl } from './normalization';

export type CrawledDomainResult = {
  business_name: string;
  website: string;
  domain: string;
  public_email?: string | null;
  email_status: 'found' | 'not_found';
  public_phone?: string | null;
  location?: string | null;
  industry?: string | null;
  description?: string | null;
  services: string[];
  contact_page?: string | null;
  about_page?: string | null;
  linkedin_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  other_social_urls: string[];
  source_urls: string[];
  source_type: string;
  activity_signals: string[];
  raw_evidence: Record<string, unknown>;
};

export class ScrapyClient {
  /**
   * Crawl a single domain or website with SSRF validation.
   */
  async crawlSingleWebsite(targetUrl: string): Promise<CrawledDomainResult | null> {
    const safeCheck = validateSafeUrl(targetUrl);
    if (!safeCheck.safe || !safeCheck.url) {
      return null;
    }

    const domain = normalizeDomain(safeCheck.url);
    if (!domain) return null;

    try {
      const crawl = await crawlPublicWebsite(safeCheck.url, { maxPages: 2, timeoutMs: 8000 });
      const publicEmail = crawl?.emails?.[0]?.email ? normalizeEmail(crawl.emails[0].email) : null;
      const publicPhone = crawl?.phones?.[0]?.phone ? normalizePhone(crawl.phones[0].phone) : null;

      const social = crawl?.social || {};

      return {
        business_name: crawl?.title || domain,
        website: safeCheck.url,
        domain,
        public_email: publicEmail,
        email_status: publicEmail ? 'found' : 'not_found',
        public_phone: publicPhone,
        location: null,
        industry: null,
        description: sanitizeUntrustedContent(crawl?.title || ''),
        services: [],
        contact_page: crawl?.emails?.[0]?.source_url || null,
        about_page: null,
        linkedin_url: cleanSocialUrl(social.linkedin),
        facebook_url: cleanSocialUrl(social.facebook),
        instagram_url: cleanSocialUrl(social.instagram),
        other_social_urls: [cleanSocialUrl(social.twitter), cleanSocialUrl(social.youtube)].filter(Boolean) as string[],
        source_urls: [safeCheck.url],
        source_type: 'public_website',
        activity_signals: crawl?.quality?.problems?.length === 0 ? ['ssl_active', 'mobile_viewport'] : ['ssl_active'],
        raw_evidence: {
          crawl_quality: crawl?.quality || null,
          emails_found: crawl?.emails || [],
          phones_found: crawl?.phones || [],
        },
      };
    } catch {
      return null;
    }
  }

  /**
   * Batch crawl multiple target websites using the Railway Scrapy service or parallel fallback.
   */
  async crawlBatchWebsites(
    jobId: string,
    tenantId: string,
    targetUrls: string[],
    options: { maxPagesPerDomain?: number; timeoutSeconds?: number; onProgress?: (completed: number, total: number) => void } = {}
  ): Promise<CrawledDomainResult[]> {
    const results: CrawledDomainResult[] = [];
    const validUrls = targetUrls
      .map((u) => validateSafeUrl(u))
      .filter((v): v is { safe: true; url: string } => Boolean(v.safe && v.url))
      .map((v) => v.url);

    // Try Railway Scrapy microservice if reachable
    try {
      const res = await callScraperService('/api/research/start', {
        method: 'POST',
        body: {
          research_job_id: jobId,
          tenant_id: tenantId,
          target_urls: validUrls,
          max_pages_per_domain: options.maxPagesPerDomain || 4,
          timeout_seconds: options.timeoutSeconds || 15,
        },
      });

      if (res.ok) {
        // Poll status until complete or timeout
        const maxWaitMs = (options.timeoutSeconds || 15) * 1000 * Math.max(1, Math.ceil(validUrls.length / 3));
        const startTime = Date.now();

        while (Date.now() - startTime < Math.min(maxWaitMs, 60000)) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const pollRes = await callScraperService(`/api/research/status/${jobId}`);
          if (pollRes.ok) {
            const data = await pollRes.json();
            if (options.onProgress && typeof data.processed_count === 'number') {
              options.onProgress(data.processed_count, validUrls.length);
            }
            if (data.status === 'completed' || data.status === 'cancelled') {
              const resMap = data.results || {};
              for (const key of Object.keys(resMap)) {
                results.push(resMap[key]);
              }
              return results;
            }
          }
        }
      }
    } catch {
      // Scrapy microservice not available or timed out — proceed with in-process crawler
    }

    // In-process resilient fallback
    const concurrency = 3;
    for (let i = 0; i < validUrls.length; i += concurrency) {
      const chunk = validUrls.slice(i, i + concurrency);
      const chunkResults = await Promise.all(chunk.map((url) => this.crawlSingleWebsite(url)));
      for (const res of chunkResults) {
        if (res) results.push(res);
      }
      if (options.onProgress) {
        options.onProgress(Math.min(validUrls.length, i + chunk.length), validUrls.length);
      }
    }

    return results;
  }
}

export const scrapyClient = new ScrapyClient();
