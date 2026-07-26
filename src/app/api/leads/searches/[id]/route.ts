import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
type Context = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const workspaceId = req.nextUrl.searchParams.get('workspaceId');
    if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    const { admin } = await requireTenantAccess(workspaceId, req);
    const { data, error } = await admin.from('lead_searches').select('*')
      .eq('workspace_id', workspaceId).eq('id', id).single();
    if (error) throw error;
    return NextResponse.json({ search: data });
  } catch (error) { return routeErrorResponse(error, 'Failed to load lead search', req); }
}

export async function PATCH(req: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const workspaceId = String(body.workspaceId || '');
    const { admin } = await requireTenantAccess(workspaceId, req);
    const allowed = ['name', 'configuration'] as const;
    const update = Object.fromEntries(allowed.filter(k => body[k] !== undefined).map(k => [k, body[k]]));
    const { data, error } = await admin.from('lead_searches').update({ ...update, updated_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json({ search: data });
  } catch (error) { return routeErrorResponse(error, 'Failed to update lead search', req); }
}
