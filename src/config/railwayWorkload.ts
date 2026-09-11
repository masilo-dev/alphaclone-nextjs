/**
 * Railway is the primary host for the web app and scraper in the current deployment model.
 * Lead Finder runs in-process on alphaclone-web by default; optional SCRAPER_SERVICE_URL for legacy scraper.
 */

import { ENV } from './env';

export function isRailwayHost(): boolean {
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
      process.env.RAILWAY_PROJECT_ID ||
      process.env.RAILWAY_SERVICE_NAME
  );
}

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
  return Boolean(
    ENV.SCRAPER_SERVICE_URL ||
      process.env.RAILWAY_SCRAPER_SERVICE_URL ||
      process.env.SCRAPER_SERVICE_INTERNAL_URL
  );
}

/** Lead Finder defaults to in-process search on the web service. */
export function shouldUseExternalScraper(): boolean {
  return false;
}

/** Heavy work stays on the web service unless an external scraper is explicitly enabled. */
export function shouldProxyHeavyWorkToRailway(): boolean {
  if (process.env.FORCE_LOCAL_HEAVY_WORK === 'true') return false;
  return hasRailwayScraper();
}

export function getScraperServiceBaseUrl(): string | null {
  return ENV.SCRAPER_SERVICE_URL ?? null;
}
