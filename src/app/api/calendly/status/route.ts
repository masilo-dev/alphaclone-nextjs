import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getCalendlyConfig } from '@/services/calendly/calendlyIntegrationService';

const manualSchema = z.object({ tenantId: z.string().uuid(), eventUrl: z.string().url().max(2048) });

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId') || '';
    await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin'], req);
    const admin = createSupabaseAdminClient();
    const config = await getCalendlyConfig(admin, tenantId);
    const { data: tenant } = await admin.from('tenants').select('settings').eq('id', tenantId).maybeSingle();
    const publicConfig = tenant?.settings?.calendly || null;
    return NextResponse.json({ connected: Boolean(config?.accessToken), manual: Boolean(publicConfig?.enabled && publicConfig?.isManual), config: publicConfig ? { enabled: Boolean(publicConfig.enabled), eventUrl: publicConfig.eventUrl || null, calendlyUserUri: publicConfig.calendlyUserUri || null, isManual: Boolean(publicConfig.isManual) } : null });
  } catch (error) { return routeErrorResponse(error, 'Calendly status could not be loaded', req); }
}

export async function PUT(req: NextRequest) {
  try {
    const parsed = manualSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'A valid Calendly event URL is required' }, { status: 400 });
    const { user } = await requireTenantRole(parsed.data.tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin'], req);
    const admin = createSupabaseAdminClient();
    const { data: tenant, error: readError } = await admin.from('tenants').select('settings').eq('id', parsed.data.tenantId).single();
    if (readError) throw readError;
    const { error } = await admin.from('tenants').update({ settings: { ...(tenant.settings || {}), calendly: { enabled: true, eventUrl: parsed.data.eventUrl, isManual: true } } }).eq('id', parsed.data.tenantId);
    if (error) throw error;
    await admin.from('calendly_integration_secrets').delete().eq('integration_id', parsed.data.tenantId);
    await admin.from('business_automation_events').insert({ tenant_id: parsed.data.tenantId, event_type: 'calendly_manual_link_updated', payload: { actorUserId: user.id } });
    return NextResponse.json({ success: true });
  } catch (error) { return routeErrorResponse(error, 'Calendly link could not be saved', req); }
}

export async function DELETE(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId') || '';
    const { user } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin'], req);
    const admin = createSupabaseAdminClient();
    const { data: tenant, error: readError } = await admin.from('tenants').select('settings').eq('id', tenantId).single();
    if (readError) throw readError;
    const { error } = await admin.from('tenants').update({ settings: { ...(tenant.settings || {}), calendly: { enabled: false } } }).eq('id', tenantId);
    if (error) throw error;
    const { error: secretError } = await admin.from('calendly_integration_secrets').delete().eq('integration_id', tenantId);
    if (secretError) throw secretError;
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'calendly_disconnected', payload: { actorUserId: user.id } });
    return NextResponse.json({ success: true });
  } catch (error) { return routeErrorResponse(error, 'Calendly could not be disconnected', req); }
}
