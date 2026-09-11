import { NextRequest, NextResponse } from 'next/server';
import {
  createAdminSupabaseClientOrThrow,
  requireTenantAccess,
  routeErrorResponse,
} from '@/lib/apiAuth';
import { decryptIntegrationConfig } from '@/lib/integration/integrationTokenCrypto';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id');

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant_id' }, { status: 400 });
    }

    const { user } = await requireTenantAccess(tenantId, request);
    const supabase = createAdminSupabaseClientOrThrow();

    const { data: integration, error } = await supabase
      .from('integrations')
      .select('config')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .eq('type', 'resend')
      .eq('enabled', true)
      .maybeSingle();

    if (error || !integration) {
      // Integration doesn't exist or isn't active
      return NextResponse.json({ domains: [] });
    }

    const config = await decryptIntegrationConfig((integration.config || {}) as Record<string, unknown>);
    const apiKey = String(config.apiKey || config.api_key || '');
    if (!apiKey) return NextResponse.json({ error: 'Resend API key is unavailable. Reconnect Resend.' }, { status: 409 });
    const resendResponse = await fetch('https://api.resend.com/domains', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (resendResponse.ok) {
      const data = await resendResponse.json();
      return NextResponse.json({ domains: data.data || [] });
    }

    const upstream = await resendResponse.json().catch(() => ({}));
    return NextResponse.json({ error: upstream.message || 'Resend could not return domains.' }, { status: resendResponse.status >= 500 ? 502 : resendResponse.status });

  } catch (error) {
    console.error('Resend domains error:', error);
    if ((error as any)?.name === 'RouteAuthError') {
      return routeErrorResponse(error, 'Internal server error');
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
