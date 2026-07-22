import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const campaignId = searchParams.get('campaignId');
    const minScore = searchParams.get('minScore');
    const grade = searchParams.get('grade');
    const status = searchParams.get('status');
    const hasEmail = searchParams.get('hasEmail') === 'true';
    const location = searchParams.get('location')?.trim();
    const limit = Math.min(Number(searchParams.get('limit') || 100), 500);

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    const { admin: supabase } = await requireTenantAccess(tenantId);

    let query = supabase
      .from('scraper_leads')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('score', { ascending: false })
      .limit(limit);

    if (campaignId) query = query.eq('campaign_id', campaignId);
    if (minScore) query = query.gte('score', Number(minScore));
    if (grade) query = query.eq('grade', grade);
    if (status) query = query.eq('status', status);
    if (hasEmail) query = query.not('email', 'is', null).neq('email', '');
    if (location) {
      const pattern = `%${location.replace(/[%_]/g, '')}%`;
      query = query.or(
        `company.ilike.${pattern},industry.ilike.${pattern},source_label.ilike.${pattern},name.ilike.${pattern}`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ leads: data || [] });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to list scraper leads');
  }
}
