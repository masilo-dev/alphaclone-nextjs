import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const idsSchema = z.array(z.string().uuid()).min(1).max(200);
const patchSchema = z.object({ messageIds: idsSchema });
const postSchema = z.object({ messageId: z.string().uuid(), recipientUserIds: idsSchema, deliveredAt: z.string().datetime() });

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    await requireTenantAccess(tenantId, req);
    const parsed = idsSchema.safeParse((req.nextUrl.searchParams.get('messageIds') || '').split(',').filter(Boolean));
    if (!parsed.success) return NextResponse.json({ error: 'Valid message IDs are required' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('message_receipts').select('message_id, user_id, delivered_at, read_at').eq('tenant_id', tenantId).in('message_id', parsed.data);
    if (error) throw error;
    return NextResponse.json({ receipts: data || [] });
  } catch (error) {
    return routeErrorResponse(error, 'Message receipts could not be loaded', req);
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Valid message IDs are required' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const now = new Date().toISOString();
    const { error } = await admin.from('message_receipts').update({ read_at: now, updated_at: now }).eq('tenant_id', tenantId).eq('user_id', user.id).in('message_id', parsed.data.messageIds).is('read_at', null);
    if (error) throw error;
    return NextResponse.json({ success: true, readAt: now });
  } catch (error) {
    return routeErrorResponse(error, 'Message receipts could not be updated', req);
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid delivery receipt' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data: message, error: messageError } = await admin.from('messages').select('id, sender_id').eq('id', parsed.data.messageId).eq('tenant_id', tenantId).maybeSingle();
    if (messageError) throw messageError;
    if (!message || message.sender_id !== user.id) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    const { data: members, error: membersError } = await admin.from('tenant_users').select('user_id').eq('tenant_id', tenantId).in('user_id', parsed.data.recipientUserIds);
    if (membersError) throw membersError;
    const allowedIds = new Set((members || []).map((member: any) => member.user_id));
    if (allowedIds.size !== new Set(parsed.data.recipientUserIds).size) return NextResponse.json({ error: 'A recipient is not a workspace member' }, { status: 400 });
    const now = new Date().toISOString();
    const { error: messageUpdateError } = await admin.from('messages').update({ delivered_at: parsed.data.deliveredAt }).eq('id', message.id).eq('tenant_id', tenantId);
    if (messageUpdateError) throw messageUpdateError;
    const { error } = await admin.from('message_receipts').upsert(parsed.data.recipientUserIds.map((userId) => ({ tenant_id: tenantId, message_id: message.id, user_id: userId, delivery_channel: 'email', delivered_at: parsed.data.deliveredAt, read_at: null, updated_at: now })), { onConflict: 'message_id,user_id,delivery_channel' });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'Message delivery receipts could not be recorded', req);
  }
}
