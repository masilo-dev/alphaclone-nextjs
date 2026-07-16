import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = body.tenantId || body.tenant_id;
    const actionId = body.actionId || body.action_id;

    if (!tenantId || !actionId) {
      return NextResponse.json({ error: 'Missing tenantId or actionId' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const admin = createSupabaseAdminClient();

    const { error } = await admin
      .from('deferred_actions')
      .update({ status: 'failed', error_message: 'Cancelled by user.' })
      .eq('id', actionId)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to cancel deferred action');
  }
}
