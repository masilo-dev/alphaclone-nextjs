import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { buildMicrosoftAuthorizeUrl, getMicrosoftRedirectUri } from '@/config/microsoft';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { generateCodeChallenge, generateCodeVerifier } from '@/lib/pkce';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';

function getAppUrl(req: NextRequest) {
  return (ENV.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || 'https://alphaclonesystems.com').replace(
    /\/$/,
    ''
  );
}

export async function GET(req: NextRequest) {
  const appUrl = getAppUrl(req);
  const { searchParams } = new URL(req.url);
  const returnTo = searchParams.get('returnTo') || '/dashboard/settings';

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(`${appUrl}/login?redirect=${encodeURIComponent(req.url)}`);
    }

    const clientId = ENV.AZURE_CLIENT_ID || ENV.VITE_AZURE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.redirect(
        `${appUrl}${returnTo}?microsoft=error&reason=${encodeURIComponent('Microsoft OAuth is not configured')}`
      );
    }

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const stateNonce = crypto.randomUUID();
    const supabaseAdmin = createSupabaseAdminClient();

    const { error: stateError } = await supabaseAdmin.from('oauth_states').insert({
      id: stateNonce,
      user_id: user.id,
      metadata: {
        code_verifier: codeVerifier,
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
      codeChallenge,
    });

    return NextResponse.redirect(authUrl);
  } catch (err: unknown) {
    console.error('[Microsoft Connect] Error:', err);
    return clientErrorResponse(err, { request: req, scope: 'auth/microsoft/connect' });
  }
}
