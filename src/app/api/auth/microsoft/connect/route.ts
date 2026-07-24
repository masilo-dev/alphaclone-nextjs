import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { buildMicrosoftAuthorizeUrl, getMicrosoftRedirectUri } from '@/config/microsoft';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { PUBLIC_APP_ORIGIN, publicAppUrl } from '@/lib/config/public-origin';

function getAppUrl(_req: NextRequest) {
  return PUBLIC_APP_ORIGIN;
}

function sanitizeReturnTo(returnTo: string | null | undefined): string {
  const fallback = '/dashboard/settings';
  const value = typeof returnTo === 'string' ? returnTo.trim() : '';
  if (!value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }
  return value;
}

export async function GET(req: NextRequest) {
  const appUrl = getAppUrl(req);
  const { searchParams } = new URL(req.url);
  const returnTo = sanitizeReturnTo(searchParams.get('returnTo'));

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const resume = publicAppUrl(`/api/auth/microsoft/connect?returnTo=${encodeURIComponent(returnTo)}`);
      return NextResponse.redirect(`${appUrl}/auth/login?redirect=${encodeURIComponent(resume)}`);
    }

    const clientId = ENV.AZURE_CLIENT_ID || ENV.VITE_AZURE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.redirect(
        `${appUrl}${returnTo}?microsoft=error&reason=${encodeURIComponent('Microsoft OAuth is not configured')}`
      );
    }

    const stateNonce = crypto.randomUUID();
    const supabaseAdmin = createSupabaseAdminClient();

    const { error: stateError } = await supabaseAdmin.from('oauth_states').insert({
      id: stateNonce,
      user_id: user.id,
      metadata: {
        provider: 'microsoft',
        return_to: returnTo,
        redirect_uri: getMicrosoftRedirectUri(appUrl),
      },
    });

    if (stateError) {
      throw stateError;
    }

    const authUrl = buildMicrosoftAuthorizeUrl(stateNonce, {
      origin: appUrl,
    });

    return NextResponse.redirect(authUrl);
  } catch (err: unknown) {
    console.error('[Microsoft Connect] Error:', err);
    return clientErrorResponse(err, { request: req, scope: 'auth/microsoft/connect' });
  }
}
