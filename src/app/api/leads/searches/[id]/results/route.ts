import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
type Context = { params: Promise<{ id: string }> };

function isUnavailableSchema(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string } | null;
  const message = String(candidate?.message || '').toLowerCase();
  return candidate?.code === '42P01'
    || candidate?.code === 'PGRST205'
    || (message.includes('lead_candidates') && (message.includes('does not exist') || message.includes('schema cache')));
}

export async function GET(req: NextRequest, context: Context) {
  try {
    const { id } = await context.params; const p = req.nextUrl.searchParams;
    const workspaceId = p.get('workspaceId'); if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    const { admin } = await requireTenantAccess(workspaceId, req);
    const limit = Math.min(100, Math.max(1, Number(p.get('limit') || 50)));
    let query = admin.from('lead_candidates').select('*').eq('workspace_id', workspaceId)
      .eq('search_id', id).order('created_at', { ascending: false }).limit(limit);
    if (p.get('cursor')) query = query.lt('created_at', p.get('cursor')!);
    if (p.get('reviewStatus')) query = query.eq('review_status', p.get('reviewStatus')!);
    const { data, error } = await query;
    if (error && isUnavailableSchema(error)) {
      return NextResponse.json(
        { candidates: [], nextCursor: null, available: false, notice: 'Lead results storage is not available for this workspace yet.' },
        { status: 200 }
      );
    }
    if (error) throw error;
    return NextResponse.json({ candidates: data || [], nextCursor: data?.length === limit ? data.at(-1)?.created_at : null });
  } catch (error) { return routeErrorResponse(error, 'Failed to load search results', req); }
}
