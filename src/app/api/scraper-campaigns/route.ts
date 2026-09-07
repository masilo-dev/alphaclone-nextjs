import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

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
    const campaigns = data || [];
    const campaignIds = campaigns.map((c: { id: string }) => c.id);
    let leadRows: Array<{
      campaign_id: string;
      email?: string | null;
      phone?: string | null;
      status?: string | null;
      crm_lead_id?: string | null;
    }> = [];
    if (campaignIds.length) {
      const leadsRes = await supabase
        .from('scraper_leads')
        .select('campaign_id, email, phone, status, crm_lead_id')
        .eq('tenant_id', tenantId)
        .in('campaign_id', campaignIds);
      leadRows = (leadsRes.data || []) as typeof leadRows;
    }
    const withCounts = campaigns.map((campaign: { id: string }) => {
      const rows = leadRows.filter((row) => row.campaign_id === campaign.id);
      const contactable = rows.filter((row) => Boolean(row.email?.trim() || row.phone?.trim())).length;
      const saved = rows.filter((row) => Boolean(row.crm_lead_id) || row.status === 'synced' || row.status === 'accepted').length;
      const contacted = rows.filter((row) => row.status === 'contacted').length;
      return {
        ...campaign,
        discovered_count: rows.length,
        contactable_count: contactable,
        accepted_count: saved,
        contacted_count: contacted,
      };
    });
    return NextResponse.json({ campaigns: withCounts });
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
