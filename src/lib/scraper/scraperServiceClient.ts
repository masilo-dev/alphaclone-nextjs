import { ENV } from '@/config/env';
import { getScraperServiceBaseUrl } from '@/config/railwayWorkload';

export async function callScraperService(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<Response> {
  const base = getScraperServiceBaseUrl() || ENV.SCRAPER_SERVICE_URL;
  if (!base) {
    throw new Error('SCRAPER_SERVICE_URL is not configured');
  }

  const url = `${base.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-internal-api-key': ENV.INTERNAL_API_KEY || process.env.INTERNAL_API_KEY || '',
  };

  return fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}
