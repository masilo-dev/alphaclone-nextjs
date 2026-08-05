import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { leadSearchInput } from '@/lib/lead-finder/core';

function isUnavailableSchema(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string } | null;
  const message = String(candidate?.message || '').toLowerCase();
  return candidate?.code === '42P01'
    || candidate?.code === 'PGRST205'
    || (message.includes('lead_searches') && (message.includes('does not exist') || message.includes('schema cache')));
}

export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get('workspaceId');
    if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    const { admin } = await requireTenantAccess(workspaceId, req);
    const { data, error } = await admin.from('lead_searches').select('*')
      .eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(100);
    if (error) {
      console.warn('[api/leads/searches] Database query notice:', error.message);
      return NextResponse.json({
        searches: [],
        available: false,
        notice: 'Lead search history table is initializing for this workspace.',
      });
    }
    return NextResponse.json({ searches: data || [], available: true });
  } catch (error) {
    return NextResponse.json({
      searches: [],
      available: false,
      notice: 'Lead search engine is initializing.',
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const input = leadSearchInput.parse(await req.json());
    const { user, admin } = await requireTenantAccess(input.workspaceId, req);
    const { data: search, error } = await admin.from('lead_searches').insert({
      workspace_id: input.workspaceId, created_by: user.id, name: input.name,
      search_type: input.searchType, query: input.query, business_keywords: input.businessKeywords,
      location: input.location, country: input.country, city: input.city, region: input.region,
      industry: input.industry, company_size_min: input.companySizeMin,
      company_size_max: input.companySizeMax, source_filters: input.sources,
      requirements: input.requirements, exclusions: input.exclusions, result_limit: input.resultLimit,
      status: input.runNow ? 'queued' : 'draft',
    }).select().single();
    if (error && isUnavailableSchema(error)) {
      return NextResponse.json(
        {
          error: 'Lead Finder is still being provisioned for this workspace.',
          available: false,
          notice: 'Apply the Lead Finder migration and refresh. If this is production, ensure Supabase schema cache has been updated.',
        },
        { status: 503 }
      );
    }
    if (error) throw error;
    if (input.runNow) {
      const { error: jobError } = await admin.from('lead_search_jobs').insert({
        workspace_id: input.workspaceId, created_by: user.id, search_id: search.id,
        job_type: 'lead.search.start', source_type: 'orchestrator',
        idempotency_key: `lead.search.start:${search.id}`,
        metadata: { sources: input.sources },
      });
      if (jobError && isUnavailableSchema(jobError)) {
        return NextResponse.json(
          {
            error: 'Lead Finder queue is not available yet for this workspace.',
            available: false,
            notice: 'Apply the Lead Finder migration that creates lead_search_jobs and the claim_lead_search_jobs function.',
          },
          { status: 503 }
        );
      }
      if (jobError) throw jobError;
    }
    await admin.from('lead_audit_logs').insert({
      workspace_id: input.workspaceId, created_by: user.id, actor_id: user.id,
      action: input.runNow ? 'search.queued' : 'search.created', entity_type: 'lead_search',
      entity_id: search.id, after_data: search,
    });
    return NextResponse.json({ search }, { status: 201 });
  } catch (error) { return routeErrorResponse(error, 'Failed to create lead search', req); }
}
