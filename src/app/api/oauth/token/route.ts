import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import crypto from 'crypto';

function normalizeRedirectUri(uri: string): string | null {
  try {
    const parsed = new URL(uri.trim());
    parsed.hash = '';
    if (parsed.pathname !== '/') {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function isTrustedPublicRedirectUri(uri: string): boolean {
  try {
    const parsed = new URL(uri);
    const host = parsed.hostname.toLowerCase();
    return (
      parsed.protocol === 'https:' &&
      (host === 'claude.ai' ||
        host.endsWith('.claude.ai') ||
        host === 'manus.im' ||
        host.endsWith('.manus.im'))
    );
  } catch {
    return false;
  }
}

function toBase64Url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function verifyPkce(
  codeVerifier: string,
  codeChallenge: string,
  codeChallengeMethod: string | null | undefined
): boolean {
  const method = (codeChallengeMethod || 'S256').toLowerCase();
  if (method === 'plain') {
    return codeVerifier === codeChallenge;
  }
  if (method === 's256') {
    const digest = crypto.createHash('sha256').update(codeVerifier).digest();
    return toBase64Url(digest) === codeChallenge;
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let body: Record<string, string> = {};

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        body[key] = value.toString();
      });
    } else if (contentType.includes('application/json')) {
      body = await req.json();
    } else {
      return NextResponse.json({ error: 'invalid_request', error_description: 'Unsupported content type' }, { status: 400 });
    }

    const { grant_type, client_id, client_secret, code, redirect_uri, refresh_token, code_verifier } = body;

    if (!client_id) {
      return NextResponse.json({ error: 'invalid_client' }, { status: 401 });
    }

    const supabaseAdmin = createSupabaseAdminClient();
    let validRegisteredClient = false;
    if (client_secret) {
      const { data: client, error: clientError } = await supabaseAdmin
        .from('mcp_oauth_clients')
        .select('client_id')
        .eq('client_id', client_id)
        .eq('client_secret', client_secret)
        .single();
      validRegisteredClient = !clientError && Boolean(client);
    }

    if (grant_type === 'authorization_code') {
      if (!code || !redirect_uri) {
        return NextResponse.json({ error: 'invalid_request', error_description: 'Missing code or redirect_uri' }, { status: 400 });
      }
      const normalizedRedirectUri = normalizeRedirectUri(redirect_uri);
      if (!normalizedRedirectUri) {
        return NextResponse.json({ error: 'invalid_request', error_description: 'Invalid redirect_uri format' }, { status: 400 });
      }

      // Verify Code
      const { data: authCode, error: codeError } = await supabaseAdmin
        .from('mcp_oauth_codes')
        .select('*')
        .eq('code', code)
        .eq('client_id', client_id)
        .eq('redirect_uri', normalizedRedirectUri)
        .single();

      if (codeError || !authCode || new Date(authCode.expires_at) < new Date()) {
        return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
      }

      if (!code_verifier || typeof code_verifier !== 'string') {
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'Missing code_verifier' },
          { status: 400 }
        );
      }
      if (!authCode.code_challenge || typeof authCode.code_challenge !== 'string') {
        return NextResponse.json(
          { error: 'invalid_grant', error_description: 'Authorization code missing PKCE challenge' },
          { status: 400 }
        );
      }
      if (!verifyPkce(code_verifier, authCode.code_challenge, authCode.code_challenge_method)) {
        return NextResponse.json(
          { error: 'invalid_grant', error_description: 'Invalid code_verifier' },
          { status: 400 }
        );
      }

      const allowTrustedPublicClient =
        !client_secret && isTrustedPublicRedirectUri(normalizedRedirectUri);
      if (!validRegisteredClient && !allowTrustedPublicClient) {
        return NextResponse.json({ error: 'invalid_client' }, { status: 401 });
      }

      // Delete used code
      await supabaseAdmin.from('mcp_oauth_codes').delete().eq('code', code);

      // Generate Tokens
      const accessToken = `mcp_at_${crypto.randomBytes(32).toString('hex')}`;
      const refreshToken = `mcp_rt_${crypto.randomBytes(32).toString('hex')}`;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      const { error: insertError } = await supabaseAdmin
        .from('mcp_oauth_tokens')
        .insert({
          access_token: accessToken,
          refresh_token: refreshToken,
          client_id,
          user_id: authCode.user_id,
          tenant_id: authCode.tenant_id,
          scopes: authCode.scopes,
          expires_at: expiresAt.toISOString()
        });

      if (insertError) {
        return NextResponse.json({ error: 'server_error' }, { status: 500 });
      }

      return NextResponse.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: refreshToken,
        scope: authCode.scopes.join(' ')
      });

    } else if (grant_type === 'refresh_token') {
      if (!refresh_token) {
        return NextResponse.json({ error: 'invalid_request', error_description: 'Missing refresh_token' }, { status: 400 });
      }
      if (!validRegisteredClient) {
        return NextResponse.json({ error: 'invalid_client' }, { status: 401 });
      }

      const { data: currentToken, error: tokenError } = await supabaseAdmin
        .from('mcp_oauth_tokens')
        .select('*')
        .eq('refresh_token', refresh_token)
        .eq('client_id', client_id)
        .single();

      if (tokenError || !currentToken) {
        return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
      }

      // We revoke the old token completely for security
      await supabaseAdmin.from('mcp_oauth_tokens').delete().eq('refresh_token', refresh_token);

      const accessToken = `mcp_at_${crypto.randomBytes(32).toString('hex')}`;
      const newRefreshToken = `mcp_rt_${crypto.randomBytes(32).toString('hex')}`;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      const { error: insertError } = await supabaseAdmin
        .from('mcp_oauth_tokens')
        .insert({
          access_token: accessToken,
          refresh_token: newRefreshToken,
          client_id,
          user_id: currentToken.user_id,
          tenant_id: currentToken.tenant_id,
          scopes: currentToken.scopes,
          expires_at: expiresAt.toISOString()
        });
        
      if (insertError) {
         return NextResponse.json({ error: 'server_error' }, { status: 500 });
      }

      return NextResponse.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: newRefreshToken,
        scope: currentToken.scopes.join(' ')
      });

    } else {
      return NextResponse.json({ error: 'unsupported_grant_type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Token endpoint error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
