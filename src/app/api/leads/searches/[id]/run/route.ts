import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { processLeadDiscoveryBatch } from '@/workers/lead-discovery-worker';
type Context = { params: Promise<{ id: string }> };

function leadSearchJobSeed(input: {
  workspaceId: string;
  userId: string;
  searchId: string;
  idempotencyKey: string;
  search?: {
    query?: string | null;
    business_keywords?: string[] | null;
    industry?: string | null;
    location?: string | null;
    city?: string | null;
    region?: string | null;
    country?: string | null;
    source_filters?: unknown;
  } | null;
}) {
  const search = input.search || {};
  const niche = [
    search.industry,
    ...(Array.isArray(search.business_keywords) ? search.business_keywords : []),
    search.query,
  ].map((part) => String(part || '').trim()).filter(Boolean).join(', ') || 'Lead discovery';
  const location = [
    search.location,
    search.city,
    search.region,
    search.country,
  ].map((part) => String(part || '').trim()).filter(Boolean).join(', ') || null;

  return {
    tenant_id: input.workspaceId,
    user_id: input.userId,
    workspace_id: input.workspaceId,
    created_by: input.userId,
    search_id: input.searchId,
    niche,
    location,
    sort_by: 'default',
    use_playwright: false,
    job_type: 'lead.search.start',
    source_type: 'orchestrator',
    idempotency_key: input.idempotencyKey,
    metadata: { sources: search.source_filters || [] },
  };
}

function isUnavailableSchema(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string } | null;
  const message = String(candidate?.message || '').toLowerCase();
  return candidate?.code === '42P01'
    || candidate?.code === 'PGRST205'
    || (message.includes('lead_search_jobs') && (message.includes('does not exist') || message.includes('schema cache')));
}

export async function POST(req: NextRequest, context: Context) {
  try {
    const { id } = await context.params; const { workspaceId } = await req.json();
    const { user, admin } = await requireTenantAccess(workspaceId, req);
    const { data: search } = await admin.from('lead_searches').select('id,status,query,business_keywords,industry,location,city,region,country,source_filters')
      .eq('workspace_id', workspaceId).eq('id', id).single();
    if (!search) return NextResponse.json({ error: 'Search not found' }, { status: 404 });
    await admin.from('lead_searches').update({ status: 'queued', progress: 0, cancelled_at: null, updated_at: new Date().toISOString() }).eq('id', id);
    const key = `lead.search.start:${id}:${crypto.randomUUID()}`;
    const { error } = await admin.from('lead_search_jobs').insert(leadSearchJobSeed({
      workspaceId,
      userId: user.id,
      searchId: id,
      idempotencyKey: key,
      search,
    }));
    if (error && isUnavailableSchema(error)) {
      return NextResponse.json(
        { error: 'Lead Finder queue is not available yet for this workspace.', available: false },
        { status: 503 }
      );
    }
    if (error) throw error;

    void processLeadDiscoveryBatch({ workerId: `api-trigger-${id}`, claimLimit: 1 }).catch((err) => {
      console.warn('[api/leads/searches/run] Immediate discovery trigger warning:', err);
    });

    return NextResponse.json({ status: 'queued' }, { status: 202 });
  } catch (error) { return routeErrorResponse(error, 'Failed to queue lead search', req); }
}
