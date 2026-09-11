import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const pageId = z.string().uuid();
const createSchema = z.object({ parentId: pageId.nullable().optional(), sortOrder: z.number().int().min(0).max(100000).default(0) });
const patchSchema = z.object({
  pageId,
  title: z.string().trim().min(1).max(300).optional(),
  icon: z.string().max(16).optional(),
  content: z.array(z.unknown()).max(5000).optional(),
  isArchived: z.boolean().optional(),
});

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params; const { user } = await requireTenantAccess(tenantId, req);
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid page details' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    if (parsed.data.parentId) {
      const { data } = await admin.from('pages').select('id').eq('tenant_id', tenantId).eq('id', parsed.data.parentId).maybeSingle();
      if (!data) return NextResponse.json({ error: 'Parent page not found' }, { status: 404 });
    }
    const { data, error } = await admin.from('pages').insert({ tenant_id: tenantId, user_id: user.id, parent_id: parsed.data.parentId || null, title: 'Untitled', icon: '📄', content: [], sort_order: parsed.data.sortOrder }).select('*').single();
    if (error) throw error;
    return NextResponse.json({ page: data }, { status: 201 });
  } catch (error) { return routeErrorResponse(error, 'Page could not be created', req); }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params; await requireTenantAccess(tenantId, req);
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid page update' }, { status: 400 });
    if (parsed.data.content && JSON.stringify(parsed.data.content).length > 1_000_000) return NextResponse.json({ error: 'Page content is too large' }, { status: 413 });
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.icon !== undefined) updates.icon = parsed.data.icon;
    if (parsed.data.content !== undefined) updates.content = parsed.data.content;
    if (parsed.data.isArchived !== undefined) updates.is_archived = parsed.data.isArchived;
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('pages').update(updates).eq('tenant_id', tenantId).eq('id', parsed.data.pageId).select('id').maybeSingle();
    if (error) throw error; if (!data) return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) { return routeErrorResponse(error, 'Page could not be saved', req); }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params; await requireTenantAccess(tenantId, req);
    const id = req.nextUrl.searchParams.get('pageId') || '';
    if (!pageId.safeParse(id).success) return NextResponse.json({ error: 'Valid pageId required' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('pages').delete().eq('tenant_id', tenantId).eq('id', id).select('id').maybeSingle();
    if (error) throw error; if (!data) return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) { return routeErrorResponse(error, 'Page could not be deleted', req); }
}
