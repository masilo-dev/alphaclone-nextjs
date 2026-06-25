/**
 * Vercel hosts the web app. Railway runs alphaclone-scraper only (Playwright, lead campaigns).
 */

import { ENV } from './env';

export const RAILWAY_HEAVY_ROUTES = [
  '/api/scraper-campaigns',
  '/api/scraper-campaigns/chat',
  '/api/scraper-leads',
  '/api/internal/leads/mcp-sync',
  '/api/cron/process-events',
  '/api/cron/sequence-worker',
  '/api/cron/sync-zoho-inbox',
  '/api/cron/lead-nurture',
  '/api/cron/scraper-campaign-poll',
] as const;

export const RAILWAY_SCRAPER_PATHS = [
  '/campaign/run',
  '/campaign/poll',
  '/enrich',
  '/scrape',
] as const;

export function isRailwayHeavyCron(path: string): boolean {
  return RAILWAY_HEAVY_ROUTES.some((r) => path.startsWith(r));
}

/** True when scraper microservice URL is configured (Railway alphaclone-scraper). */
export function hasRailwayScraper(): boolean {
  return Boolean(ENV.SCRAPER_SERVICE_URL);
}

/**
 * Prefer Railway for Playwright scraping, enrichment, and campaign runs.
 * On Vercel without SCRAPER_SERVICE_URL, callers should use OSM fallback.
 */
export function shouldProxyHeavyWorkToRailway(): boolean {
  if (process.env.FORCE_LOCAL_HEAVY_WORK === 'true') return false;
  return hasRailwayScraper();
}

export function getScraperServiceBaseUrl(): string | null {
  return ENV.SCRAPER_SERVICE_URL ?? null;
}
