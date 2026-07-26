import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
const schema = z.object({ workspaceId: z.string().uuid(), name: z.string().trim().min(1).max(120), description: z.string().max(500).optional(), colour: z.string().max(30).optional() });
export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get('workspaceId');
    if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    const { admin } = await requireTenantAccess(workspaceId, req);
    const { data, error } = await admin.from('lead_lists').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false });
    if (error) throw error; return NextResponse.json({ lists: data || [] });
  } catch (error) { return routeErrorResponse(error, 'Failed to load lead lists', req); }
}
export async function POST(req: NextRequest) {
  try {
    const input = schema.parse(await req.json()); const { user, admin } = await requireTenantAccess(input.workspaceId, req);
    const { data, error } = await admin.from('lead_lists').insert({ workspace_id: input.workspaceId, created_by: user.id, name: input.name, description: input.description, colour: input.colour }).select().single();
    if (error) throw error; return NextResponse.json({ list: data }, { status: 201 });
  } catch (error) { return routeErrorResponse(error, 'Failed to create lead list', req); }
}
