import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('read'), messageId: z.string().uuid() }),
  z.object({ action: z.literal('archive'), messageId: z.string().uuid() }),
  z.object({ action: z.literal('trash'), messageId: z.string().uuid() }),
  z.object({ action: z.literal('star'), messageId: z.string().uuid(), value: z.boolean() }),
  z.object({ action: z.literal('needs_response'), messageId: z.string().uuid(), value: z.boolean() }),
  z.object({ action: z.literal('replied'), messageId: z.string().uuid() }),
]);

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    await requireTenantAccess(tenantId, req);

    const { searchParams } = new URL(req.url);
    const folder = searchParams.get('folder') || 'inbox';
    const search = searchParams.get('search')?.trim();
    const limit = Math.max(1, Math.min(Number(searchParams.get('limit') || 50), 200));

    const admin = createSupabaseAdminClient();
    let query = admin
      .from('unified_messages')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (folder !== 'all') {
      query = query.eq('folder', folder.toLowerCase());
    }

    if (search) {
      query = query.or(`subject.ilike.%${search}%,from_address.ilike.%${search}%,body.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .order('received_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      messages: data || [],
      total: count || 0,
      folder,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Inbox messages could not be loaded', req);
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid inbox operation' }, { status: 400 });
    const now = new Date().toISOString();
    const update = parsed.data.action === 'read' ? { read: true, read_at: now }
      : parsed.data.action === 'archive' ? { archived: true, folder: 'archive' }
      : parsed.data.action === 'trash' ? { archived: false, folder: 'trash' }
      : parsed.data.action === 'star' ? { starred: parsed.data.value }
      : parsed.data.action === 'needs_response' ? { needs_response: parsed.data.value }
      : { replied_at: now, needs_response: false, read: true, read_at: now };
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('unified_messages').update(update).eq('tenant_id', tenantId).eq('id', parsed.data.messageId).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: `inbox_message_${parsed.data.action}`, payload: { messageId: parsed.data.messageId, actorUserId: user.id } });
    return NextResponse.json({ success: true });
  } catch (error) { return routeErrorResponse(error, 'Inbox state could not be updated', req); }
}
