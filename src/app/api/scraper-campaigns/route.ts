import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    const { admin: supabase } = await requireTenantAccess(tenantId);
    const { data, error } = await supabase
      .from('scraper_campaigns')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ campaigns: data || [] });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to list scraper campaigns');
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantId, ...campaign } = body;

    if (!tenantId || !campaign.name) {
      return NextResponse.json({ error: 'Missing tenantId or name' }, { status: 400 });
    }

    const { user, admin: supabase } = await requireTenantAccess(tenantId);

    const sources = campaign.sources || (campaign.source ? [campaign.source] : ['website', 'directory']);

    const { data, error } = await supabase
      .from('scraper_campaigns')
      .insert({
        tenant_id: tenantId,
        name: campaign.name,
        status: campaign.status || 'paused',
        source: campaign.source || sources[0],
        sources,
        location: campaign.location || {},
        industry: campaign.industry || [],
        title_keywords: campaign.title_keywords || [],
        company_size_range: campaign.company_size_range || {},
        exclude_domains: campaign.exclude_domains || [],
        daily_limit: campaign.daily_limit ?? 50,
        weekly_limit: campaign.weekly_limit ?? 200,
        enrichment_level: campaign.enrichment_level || 'full',
        scoring_rules: campaign.scoring_rules || {},
        min_score_threshold: campaign.min_score_threshold ?? 40,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ campaign: data });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to create scraper campaign');
  }
}
