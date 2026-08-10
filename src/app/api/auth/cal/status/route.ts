import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import {
  getCalcomConfig,
  disconnectCalcomIntegration,
} from '@/services/calcom/calcomIntegrationService';

export const runtime = 'nodejs';

/** GET /api/auth/cal/status?tenantId=xxx — returns connection state */
export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId') || '';
    await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin'], req);
    const admin = createSupabaseAdminClient();
    const config = await getCalcomConfig(admin, tenantId);
    return NextResponse.json({
      connected: Boolean(config?.connected),
      email: config?.email ?? null,
      username: config?.username ?? null,
      expiresAt: config?.expiresAt ?? null,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Cal.com status could not be loaded', req);
  }
}

/** DELETE /api/auth/cal/status?tenantId=xxx — disconnects Cal.com */
export async function DELETE(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId') || '';
    const { user } = await requireTenantRole(
      tenantId,
      ['owner', 'admin', 'tenant_admin', 'super_admin'],
      req
    );
    const admin = createSupabaseAdminClient();
    await disconnectCalcomIntegration(admin, tenantId);
    await admin.from('business_automation_events').insert({
      tenant_id: tenantId,
      event_type: 'integration_disconnected',
      payload: { integrationId: 'calcom', actorUserId: user.id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'Cal.com could not be disconnected', req);
  }
}
