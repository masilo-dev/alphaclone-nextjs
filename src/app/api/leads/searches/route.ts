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
    if (error && isUnavailableSchema(error)) {
      return NextResponse.json({
        searches: [],
        available: false,
        notice: 'Lead search history is being prepared for this workspace.',
      });
    }
    if (error) throw error;
    return NextResponse.json({ searches: data || [], available: true });
  } catch (error) { return routeErrorResponse(error, 'Failed to load lead searches', req); }
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
    if (error) throw error;
    if (input.runNow) {
      const { error: jobError } = await admin.from('lead_search_jobs').insert({
        workspace_id: input.workspaceId, created_by: user.id, search_id: search.id,
        job_type: 'lead.search.start', source_type: 'orchestrator',
        idempotency_key: `lead.search.start:${search.id}`,
        metadata: { sources: input.sources },
      });
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
