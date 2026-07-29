import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
type Context = { params: Promise<{ id: string }> };

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
    const { data: search } = await admin.from('lead_searches').select('id,status')
      .eq('workspace_id', workspaceId).eq('id', id).single();
    if (!search) return NextResponse.json({ error: 'Search not found' }, { status: 404 });
    await admin.from('lead_searches').update({ status: 'queued', progress: 0, cancelled_at: null, updated_at: new Date().toISOString() }).eq('id', id);
    const key = `lead.search.start:${id}:${crypto.randomUUID()}`;
    const { error } = await admin.from('lead_search_jobs').insert({
      workspace_id: workspaceId, created_by: user.id, search_id: id, job_type: 'lead.search.start',
      source_type: 'orchestrator', idempotency_key: key,
    });
    if (error && isUnavailableSchema(error)) {
      return NextResponse.json(
        { error: 'Lead Finder queue is not available yet for this workspace.', available: false },
        { status: 503 }
      );
    }
    if (error) throw error;
    return NextResponse.json({ status: 'queued' }, { status: 202 });
  } catch (error) { return routeErrorResponse(error, 'Failed to queue lead search', req); }
}
