import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { ENV } from '@/config/env';
import { stripOAuthTokens } from '@/lib/security/productionGuard';

export const runtime = 'nodejs';

function publicConnection(row: Record<string, unknown> | null) {
  return stripOAuthTokens(row);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const forceRefresh = body?.force === true;

    const admin = createSupabaseAdminClient();
    const { data: connection, error: connectionError } = await admin
      .from('microsoft_connections')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (connectionError) {
      throw connectionError;
    }

    const refreshToken = connection?.refresh_token;
    if (!refreshToken) {
      return NextResponse.json({ error: 'No Microsoft refresh token available.' }, { status: 400 });
    }

    const expiresAt = connection?.token_expiry ? new Date(connection.token_expiry).getTime() : 0;
    const needsRefresh =
      forceRefresh ||
      !connection?.token_expiry ||
      Number.isNaN(expiresAt) ||
      Date.now() + 5 * 60 * 1000 >= expiresAt;

    if (!needsRefresh && connection) {
      return NextResponse.json({
        success: true,
        refreshed: false,
        connection: publicConnection(connection as Record<string, unknown>),
      });
    }

    const clientId = ENV.AZURE_CLIENT_ID || ENV.VITE_AZURE_CLIENT_ID;
    const clientSecret = ENV.AZURE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Microsoft OAuth is not configured on the server.' },
        { status: 500 }
      );
    }

    // Azure AD v2.0 confidential-client flow: send client_id + client_secret
    // in the POST body. Do NOT use Basic Auth — that causes an auth error.
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const tokenPayload = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok) {
      console.error('[Microsoft Refresh] Token endpoint error:', tokenPayload);
      return NextResponse.json(
        { error: tokenPayload?.error_description || tokenPayload?.error || 'Microsoft refresh failed' },
        { status: 400 }
      );
    }

    const updated = {
      access_token: tokenPayload.access_token,
      refresh_token: tokenPayload.refresh_token || refreshToken,
      token_expiry: tokenPayload.expires_in
        ? new Date(Date.now() + Number(tokenPayload.expires_in) * 1000).toISOString()
        : connection?.token_expiry || null,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedConnection, error: updateError } = await admin
      .from('microsoft_connections')
      .update(updated)
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      refreshed: true,
      connection: publicConnection(updatedConnection as Record<string, unknown>),
    });
  } catch (err: unknown) {
    console.error('[Microsoft Refresh] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to refresh Microsoft access token' },
      { status: 500 }
    );
  }
}
