import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { callScraperService } from '@/lib/scraper/scraperServiceClient';

export const dynamic = 'force-dynamic';

/**
 * Railway cron entry for alphaclone-scraper campaign polling.
 * Proxies to the Python scraper service with internal API key auth.
 */
async function pollCampaigns(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  try {
    const scraperRes = await callScraperService('/api/scraper/campaign/poll', {
      method: 'POST',
      body: {},
    });

    const text = await scraperRes.text();
    let payload: unknown = { status: 'polling' };
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { status: 'polling', raw: text.slice(0, 500) };
      }
    }

    if (!scraperRes.ok) {
      return NextResponse.json(
        { error: 'Scraper service poll failed', detail: payload },
        { status: scraperRes.status >= 400 ? scraperRes.status : 502 }
      );
    }

    return NextResponse.json({ success: true, ...(payload as Record<string, unknown>) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Scraper poll failed';
    console.error('[scraper/campaign/poll]', message);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function GET(req: NextRequest) {
  return pollCampaigns(req);
}

export async function POST(req: NextRequest) {
  return pollCampaigns(req);
}
