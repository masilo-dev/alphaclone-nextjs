import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const tenantId = req.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();

    const { data: campaign, error } = await supabase
      .from('scraper_campaigns')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) throw error;

    const { data: runs } = await supabase
      .from('lead_campaign_runs')
      .select('*')
      .eq('campaign_id', id)
      .order('run_at', { ascending: false })
      .limit(5);

    return NextResponse.json({ campaign, runs: runs || [] });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to get scraper campaign');
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { tenantId, ...updates } = body;

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('scraper_campaigns')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ campaign: data });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to update scraper campaign');
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const tenantId = req.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('scraper_campaigns')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to delete scraper campaign');
  }
}
