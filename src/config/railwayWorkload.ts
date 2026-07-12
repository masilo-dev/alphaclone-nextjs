/**
 * Railway is the primary host for the web app and scraper in the current deployment model.
 * These routes are the heavier lead-generation workloads that should stay paired with Railway
 * whenever SCRAPER_SERVICE_URL is configured.
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

/** True when the Railway scraper microservice URL is configured. */
export function hasRailwayScraper(): boolean {
  return Boolean(ENV.SCRAPER_SERVICE_URL);
}

/**
 * Prefer the Railway scraper for Playwright scraping, enrichment, and campaign runs.
 * If the scraper is unavailable, callers should fall back to local/free sources.
 */
export function shouldProxyHeavyWorkToRailway(): boolean {
  if (process.env.FORCE_LOCAL_HEAVY_WORK === 'true') return false;
  return hasRailwayScraper();
}

export function getScraperServiceBaseUrl(): string | null {
  return ENV.SCRAPER_SERVICE_URL ?? null;
}
