import { NextRequest, NextResponse } from 'next/server';
import {
  createAdminSupabaseClientOrThrow,
  requireTenantAccess,
  routeErrorResponse,
} from '@/lib/apiAuth';
import { resendConnectSchema } from '@/schemas/validation';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const parsed = resendConnectSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
    }
    const tenantId = parsed.data.tenantId || parsed.data.tenant_id!;
    const api_key = parsed.data.api_key;
    const domain = parsed.data.domain;

    await requireTenantAccess(tenantId);
    const supabase = createAdminSupabaseClientOrThrow();

    // Upsert the integration
    const { data, error } = await supabase
      .from('tenant_integrations')
      .upsert({
        tenant_id: tenantId,
        integration_type: 'resend',
        status: 'active',
        access_token: api_key,
        domain: domain
      }, { onConflict: 'tenant_id, integration_type' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message, code: 'INTEGRATION_UPSERT_FAILED' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Resend integration connected successfully',
      integration: data
    });

  } catch (error) {
    console.error('Resend connect error:', error);
    return routeErrorResponse(error, 'Failed to connect Resend provider', request);
  }
}
