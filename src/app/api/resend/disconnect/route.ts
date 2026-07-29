import { NextRequest, NextResponse } from 'next/server';
import {
  createAdminSupabaseClientOrThrow,
  requireTenantAccess,
  routeErrorResponse,
} from '@/lib/apiAuth';
import { resendDisconnectSchema } from '@/schemas/validation';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const parsed = resendDisconnectSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
    }
    const tenantId = parsed.data.tenantId || parsed.data.tenant_id!;

    await requireTenantAccess(tenantId);
    const supabase = createAdminSupabaseClientOrThrow();

    // Delete the integration
    const { error } = await supabase
      .from('tenant_integrations')
      .update({ status: 'inactive' })
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'resend');

    if (error) {
      return NextResponse.json({ error: error.message, code: 'INTEGRATION_UPDATE_FAILED' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Resend integration disconnected successfully'
    });

  } catch (error) {
    console.error('Resend disconnect error:', error);
    return routeErrorResponse(error, 'Failed to disconnect Resend provider', request);
  }
}
