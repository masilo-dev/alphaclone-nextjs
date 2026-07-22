import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { callScraperService } from '@/lib/scraper/scraperServiceClient';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const tenantId = body.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    const { user, admin: supabase } = await requireTenantAccess(tenantId);

    const { data: campaign, error } = await supabase
      .from('scraper_campaigns')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const scraperRes = await callScraperService('/api/scraper/campaign/run', {
      method: 'POST',
      body: {
        campaign_id: id,
        tenant_id: tenantId,
        user_id: user.id,
      },
    });

    if (!scraperRes.ok) {
      const text = await scraperRes.text();
      return NextResponse.json(
        { error: `Scraper service error: ${text}` },
        { status: 502 }
      );
    }

    const result = await scraperRes.json();
    return NextResponse.json({ status: 'started', campaign_id: id, ...result });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to start campaign run');
  }
}
