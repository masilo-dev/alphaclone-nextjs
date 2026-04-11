import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

function appBaseUrl(): string {
  return (ENV.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclone.tech').replace(/\/$/, '');
}

export async function GET(req: NextRequest) {
  const base = appBaseUrl();
  const sp = req.nextUrl.searchParams;
  const code = sp.get('code');
  const state = sp.get('state');
  const errParam = sp.get('error');

  const fail = (reason: string) =>
    NextResponse.redirect(`${base}/dashboard/settings?section=integrations&zoom_error=${encodeURIComponent(reason)}`);

  if (errParam) {
    return fail(errParam);
  }
  if (!code || !state) {
    return fail('missing_params');
  }

  const clientId = ENV.ZOOM_CLIENT_ID || process.env.ZOOM_CLIENT_ID;
  const clientSecret = ENV.ZOOM_CLIENT_SECRET || process.env.ZOOM_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return fail('not_configured');
  }

  const redirectUri = `${base}/api/zoom/oauth/callback`;

  try {
    const admin = createSupabaseAdminClient();

    const { data: st, error: stateErr } = await admin
      .from('oauth_states')
      .delete()
      .eq('id', state)
      .select('user_id, tenant_id')
      .single();

    if (stateErr || !st?.tenant_id || !st.user_id) {
      return fail('invalid_state');
    }

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tok = await tokenRes.json();
    if (!tokenRes.ok || !tok.access_token) {
      console.error('[Zoom OAuth] token error:', tok);
      return fail('token_exchange');
    }

    const expiresIn = typeof tok.expires_in === 'number' ? tok.expires_in : parseInt(String(tok.expires_in), 10) || 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    let zoomAccountId: string | null = null;
    try {
      const ur = await fetch('https://api.zoom.us/v2/users/me', {
        headers: { Authorization: `Bearer ${tok.access_token}` },
      });
      const uj = await ur.json();
      if (uj.id) zoomAccountId = String(uj.id);
    } catch {
      /* optional */
    }

    const metadata = {
      zoom_access_token: tok.access_token as string,
      zoom_refresh_token: (tok.refresh_token as string) || '',
      zoom_expires_at: expiresAt,
      zoom_scope: (tok.scope as string) || '',
      zoom_account_id: zoomAccountId,
    };

    const { error: upErr } = await admin.from('tenant_integrations').upsert(
      {
        tenant_id: st.tenant_id,
        integration_id: 'zoom',
        status: 'connected',
        connected_at: new Date().toISOString(),
        configured_by: st.user_id,
        metadata,
      },
      { onConflict: 'tenant_id,integration_id' }
    );

    if (upErr) {
      console.error('[Zoom OAuth] tenant_integrations upsert:', upErr);
      return fail('database');
    }

    try {
      await admin.from('tenant_zoom_settings').upsert(
        {
          tenant_id: st.tenant_id,
          integration_mode: 'meeting_api',
          zoom_account_id: zoomAccountId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' }
      );
    } catch {
      /* table may not exist until zoom migration applied */
    }

    return NextResponse.redirect(`${base}/dashboard/settings?section=integrations&zoom=connected`);
  } catch (e) {
    console.error('[Zoom OAuth] callback error:', e);
    return fail('unexpected');
  }
}
