import { NextRequest, NextResponse } from 'next/server';
import {
  createAdminSupabaseClientOrThrow,
  requireTenantAccess,
  routeErrorResponse,
} from '@/lib/apiAuth';

export async function POST(request: NextRequest) {
  try {
    const { tenant_id, tenantId: tenantIdInput, api_key, domain } = await request.json();
    const tenantId = tenantIdInput || tenant_id;

    if (!tenantId || !api_key || !domain) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

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
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Resend integration connected successfully',
      integration: data
    });

  } catch (error) {
    console.error('Resend connect error:', error);
    if ((error as any)?.name === 'RouteAuthError') {
      return routeErrorResponse(error, 'Internal server error');
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
