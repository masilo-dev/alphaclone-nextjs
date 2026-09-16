import { NextRequest, NextResponse } from 'next/server';
import 'server-only';

import { resolveSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireClientPortalSession } from '@/lib/auth/clientPortalAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const admin = await resolveSupabaseAdminClient();
    const session = await requireClientPortalSession(admin);

    if (!session.ok) {
      const status = session.error.http;
      const code = session.error.code;
      return NextResponse.json(
        { error: code === 'CLIENT_INACTIVE' ? 'Account is not active' : 'Not authenticated' },
        { status }
      );
    }

    const { data: client, error: clientError } = await admin
      .from('business_clients')
      .select('id, tenant_id, name, email, finance_portal_token, is_active')
      .eq('id', session.session.clientId)
      .eq('tenant_id', session.session.tenantId)
      .maybeSingle();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      client: {
        id: client.id,
        tenantId: client.tenant_id,
        name: client.name,
        email: client.email,
        isActive: client.is_active !== false,
        portalToken: client.finance_portal_token,
      },
      sessionJti: session.session.sessionJti,
    });
  } catch (error) {
    console.error('[client-portal-auth/me]', error);
    return NextResponse.json(
      { error: 'Failed to load session' },
      { status: 500 }
    );
  }
}
