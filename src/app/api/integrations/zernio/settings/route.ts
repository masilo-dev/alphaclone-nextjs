import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const schema = z.object({ tenantId: z.string().uuid(), instagramAccountId: z.string().trim().max(300).optional(), linkedinOrgAccountId: z.string().trim().max(300).optional() });

export async function PUT(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid Zernio settings' }, { status: 400 });
    const { user } = await requireTenantRole(parsed.data.tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin'], req);
    const admin = createSupabaseAdminClient();
    const { data: tenant, error: readError } = await admin.from('tenants').select('settings').eq('id', parsed.data.tenantId).single();
    if (readError) throw readError;
    const settings = tenant.settings || {};
    const { error } = await admin.from('tenants').update({ settings: { ...settings, zernio: { ...(settings.zernio || {}), instagramAccountId: parsed.data.instagramAccountId || null, linkedinOrgAccountId: parsed.data.linkedinOrgAccountId || null } } }).eq('id', parsed.data.tenantId);
    if (error) throw error;
    await admin.from('business_automation_events').insert({ tenant_id: parsed.data.tenantId, event_type: 'zernio_settings_updated', payload: { actorUserId: user.id } });
    return NextResponse.json({ success: true });
  } catch (error) { return routeErrorResponse(error, 'Zernio settings could not be saved', req); }
}
