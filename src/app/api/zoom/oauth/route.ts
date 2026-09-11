import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantRole, RouteAuthError } from '@/lib/apiAuth';

/**
 * Starts Zoom OAuth for a tenant workspace.
 * Query: tenant_id (required). User must be a member of that tenant.
 */
export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenant_id');
    if (!tenantId?.trim()) {
      return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
    }

    let userId: string;
    try {
      const { user } = await requireTenantRole(
        tenantId.trim(),
        ['owner', 'admin', 'tenant_admin', 'super_admin'],
        req
      );
      userId = user.id;
    } catch (e) {
      const status = e instanceof RouteAuthError ? e.status : 401;
      return NextResponse.json({ error: 'Unauthorized' }, { status });
    }

    const clientId = ENV.ZOOM_CLIENT_ID || process.env.ZOOM_CLIENT_ID;
    const clientSecret = ENV.ZOOM_CLIENT_SECRET || process.env.ZOOM_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Zoom OAuth is not configured' }, { status: 500 });
    }

    const appUrl = (ENV.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com').replace(
      /\/$/,
      ''
    );
    const redirectUri = `${appUrl}/api/zoom/oauth/callback`;

    const admin = createSupabaseAdminClient();
    const insertPayload = {
      user_id: userId,
      tenant_id: tenantId.trim(),
      metadata: { provider: 'zoom' },
    };

    const { data: stateRow, error: stErr } = await admin
      .from('oauth_states')
      .insert(insertPayload)
      .select('id')
      .single();

    if (stErr || !stateRow) {
      console.error('[Zoom OAuth] oauth_states insert:', stErr);
      return NextResponse.json(
        {
          error:
            'Failed to start OAuth. Ensure migration 20260412100000_oauth_states_tenant_id.sql is applied if tenant_id column is missing.',
        },
        { status: 500 }
      );
    }

    const scopes = (ENV.ZOOM_OAUTH_SCOPES || 'user:read:user meeting:read meeting:write').trim();
    const authUrl = new URL('https://zoom.us/oauth/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', stateRow.id);
    if (scopes) {
      authUrl.searchParams.set('scope', scopes);
    }

    return NextResponse.redirect(authUrl.toString());
  } catch (err) {
    console.error('[Zoom OAuth] authorize error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
