import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const schema = z.object({ tenantId: z.string().uuid(), userId: z.string().uuid(), type: z.enum(['message', 'project', 'payment', 'system', 'alert', 'task']), title: z.string().trim().min(1).max(250), message: z.string().trim().max(4000).optional(), link: z.string().trim().max(2000).optional(), priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'), metadata: z.record(z.string(), z.unknown()).default({}) });

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid notification' }, { status: 400 });
    const value = parsed.data;
    await requireTenantAccess(value.tenantId, req);
    const admin = createSupabaseAdminClient();
    const { data: recipient, error: recipientError } = await admin.from('tenant_users').select('user_id').eq('tenant_id', value.tenantId).eq('user_id', value.userId).maybeSingle();
    if (recipientError) throw recipientError;
    if (!recipient) return NextResponse.json({ error: 'Notification recipient is not a workspace member' }, { status: 400 });
    const { data, error } = await admin.from('notifications').insert({ tenant_id: value.tenantId, user_id: value.userId, type: value.type, title: value.title, message: value.message || null, link: value.link || null, priority: value.priority, metadata: value.metadata, read: false }).select('*').single();
    if (error) throw error;
    return NextResponse.json({ success: true, notification: data }, { status: 201 });
  } catch (error) { return routeErrorResponse(error, 'Notification could not be sent', req); }
}

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId') || '';
    const { user } = await requireTenantAccess(tenantId, req);
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('notifications').select('*').eq('tenant_id', tenantId).eq('user_id', user.id).order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    return NextResponse.json({ notifications: data || [] });
  } catch (error) { return routeErrorResponse(error, 'Notifications could not be loaded', req); }
}

const updateSchema = z.object({ tenantId: z.string().uuid(), ids: z.array(z.string().uuid()).min(1).max(200), read: z.literal(true) });
export async function PATCH(req: NextRequest) {
  try {
    const parsed = updateSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid notification update' }, { status: 400 });
    const { user } = await requireTenantAccess(parsed.data.tenantId, req);
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from('notifications').update({ read: true }).eq('tenant_id', parsed.data.tenantId).eq('user_id', user.id).in('id', parsed.data.ids);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) { return routeErrorResponse(error, 'Notifications could not be updated', req); }
}

export async function DELETE(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId') || '';
    const notificationId = req.nextUrl.searchParams.get('notificationId') || '';
    if (!z.string().uuid().safeParse(notificationId).success) return NextResponse.json({ error: 'Valid notificationId is required' }, { status: 400 });
    const { user } = await requireTenantAccess(tenantId, req);
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('notifications').delete().eq('id', notificationId).eq('tenant_id', tenantId).eq('user_id', user.id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) { return routeErrorResponse(error, 'Notification could not be deleted', req); }
}
