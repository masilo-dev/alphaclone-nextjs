import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const schema = z.object({ tenantId: z.string().uuid(), pageId: z.string().trim().min(1).max(300) });

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Valid tenantId and pageId required' }, { status: 400 });
    const { user } = await requireTenantRole(parsed.data.tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin'], req);
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('facebook_integrations').update({ is_active: false, updated_at: new Date().toISOString() }).eq('tenant_id', parsed.data.tenantId).eq('page_id', parsed.data.pageId).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Facebook Page connection not found' }, { status: 404 });
    await admin.from('business_automation_events').insert({ tenant_id: parsed.data.tenantId, event_type: 'facebook_page_disconnected', payload: { pageId: parsed.data.pageId, actorUserId: user.id } });
    return NextResponse.json({ success: true });
  } catch (error) { return routeErrorResponse(error, 'Facebook Page could not be disconnected', req); }
}
