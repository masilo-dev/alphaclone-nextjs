import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { callScraperService } from '@/lib/scraper/scraperServiceClient';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const tenantId = req.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);

    const scraperRes = await callScraperService(`/api/scraper/status/${id}`);
    if (!scraperRes.ok) {
      const text = await scraperRes.text();
      return NextResponse.json({ error: text }, { status: 502 });
    }

    const status = await scraperRes.json();
    return NextResponse.json(status);
  } catch (error) {
    return routeErrorResponse(error, 'Failed to get campaign status');
  }
}
