import { NextRequest, NextResponse } from 'next/server';
import {
  createAdminSupabaseClientOrThrow,
  requireTenantAccess,
  routeErrorResponse,
} from '@/lib/apiAuth';

export async function POST(request: NextRequest) {
  try {
    const { tenant_id, tenantId: tenantIdInput } = await request.json();
    const tenantId = tenantIdInput || tenant_id;

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant_id' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const supabase = createAdminSupabaseClientOrThrow();

    // Delete the integration
    const { error } = await supabase
      .from('tenant_integrations')
      .update({ status: 'inactive' })
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'resend');

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Resend integration disconnected successfully'
    });

  } catch (error) {
    console.error('Resend disconnect error:', error);
    if ((error as any)?.name === 'RouteAuthError') {
      return routeErrorResponse(error, 'Internal server error');
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
