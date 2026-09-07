import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

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

    const { runCampaignOnPlatform } = await import('@/lib/scraper/scraperPlatform');
    const result = await runCampaignOnPlatform(tenantId, user.id, id);
    return NextResponse.json({ success: true, campaign, ...result });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to start campaign run');
  }
}
