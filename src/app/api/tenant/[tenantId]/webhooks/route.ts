import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { assertSafeExternalHttpUrl } from '@/lib/security/externalUrl';
import { encryptIntegrationToken } from '@/lib/integration/integrationTokenCrypto';

const EVENTS = ['deal.stage_changed', 'invoice.created', 'lead.created', 'contact.created'] as const;
const createSchema = z.object({ url: z.string().url().max(2048), events: z.array(z.enum(EVENTS)).min(1).max(EVENTS.length) });

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    await requireTenantAccess(tenantId, req);
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('webhooks').select('id, tenant_id, url, events, is_active, created_at, updated_at').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ webhooks: data || [] });
  } catch (error) { return routeErrorResponse(error, 'Webhooks could not be loaded', req); }
}

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin'], req);
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'A valid public webhook URL and event selection are required' }, { status: 400 });
    const safeUrl = await assertSafeExternalHttpUrl(parsed.data.url);
    const admin = createSupabaseAdminClient();
    const { data: existing } = await admin.from('webhooks').select('id').eq('tenant_id', tenantId).eq('url', safeUrl.toString()).maybeSingle();
    if (existing) return NextResponse.json({ error: 'This webhook URL is already registered' }, { status: 409 });
    const secret = `whsec_${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;
    const { data, error } = await admin.from('webhooks').insert({ tenant_id: tenantId, url: safeUrl.toString(), events: parsed.data.events, secret: await encryptIntegrationToken(secret), is_active: true }).select('id, tenant_id, url, events, is_active, created_at, updated_at').single();
    if (error) throw error;
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'webhook_registered', payload: { webhookId: data.id, actorUserId: user.id } });
    return NextResponse.json({ webhook: data, secret }, { status: 201 });
  } catch (error) { return routeErrorResponse(error, 'Webhook could not be registered', req); }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin'], req);
    const id = req.nextUrl.searchParams.get('id') || '';
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Valid webhook id required' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('webhooks').delete().eq('tenant_id', tenantId).eq('id', id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'webhook_deleted', payload: { webhookId: id, actorUserId: user.id } });
    return NextResponse.json({ success: true });
  } catch (error) { return routeErrorResponse(error, 'Webhook could not be deleted', req); }
}
