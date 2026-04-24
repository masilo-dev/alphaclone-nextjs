'use server';

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import crypto from 'crypto';
import { validateScopes } from '@/services/mcp/MCPOAuthScopes';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function isAllowedRedirectUri(allowedUris: string[], redirectUri: string): boolean {
  const normalizedIncoming = normalizeRedirectUri(redirectUri);
  if (!normalizedIncoming) return false;
  return allowedUris.some((uri) => normalizeRedirectUri(uri) === normalizedIncoming);
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

function normalizeCodeChallengeMethod(method: string | undefined): 'S256' | 'plain' | null {
  if (!method) return null;
  const normalized = method.trim().toLowerCase();
  if (normalized === 's256') return 'S256';
  if (normalized === 'plain') return 'plain';
  return null;
}

export async function authorizeClient(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const client_id = formData.get('client_id')?.toString();
  const redirect_uri = formData.get('redirect_uri')?.toString();
  const state = formData.get('state')?.toString();
  const scope = formData.get('scope')?.toString();
  const response_type = formData.get('response_type')?.toString() || 'code';
  const codeChallenge = formData.get('code_challenge')?.toString();
  const codeChallengeMethod = normalizeCodeChallengeMethod(
    formData.get('code_challenge_method')?.toString() || 'S256'
  );

  if (!client_id || !redirect_uri) {
    return { error: 'Missing client_id or redirect_uri' };
  }
  if (response_type !== 'code') {
    return { error: 'Unsupported response_type. Expected code.' };
  }
  if (!codeChallenge) {
    return { error: 'Missing code_challenge' };
  }
  if (!codeChallengeMethod) {
    return { error: 'Unsupported code_challenge_method. Use S256 or plain.' };
  }

  const normalizedRedirectUri = normalizeRedirectUri(redirect_uri);
  if (!normalizedRedirectUri) {
    return { error: 'Invalid redirect_uri format' };
  }

  // Find user's active tenant
  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single();

  if (!tenantUser) {
    return { error: 'No active workspace found' };
  }

  const supabaseAdmin = createSupabaseAdminClient();

  // Validate client
  const { data: client } = await supabaseAdmin
    .from('mcp_oauth_clients')
    .select('redirect_uris')
    .eq('client_id', client_id)
    .single();

  const clientRedirectUris = Array.isArray(client?.redirect_uris) ? client.redirect_uris : [];
  const clientAllowsRedirect = Boolean(client) && isAllowedRedirectUri(clientRedirectUris, normalizedRedirectUri);
  const clientLooksLikeTenantId = UUID_V4_REGEX.test(client_id) && client_id === tenantUser.tenant_id;
  const allowTrustedPublicClient = clientLooksLikeTenantId && isTrustedPublicRedirectUri(normalizedRedirectUri);

  if (!clientAllowsRedirect && !allowTrustedPublicClient) {
      return { error: 'Invalid client_id or redirect_uri mismatch' };
  }

  if (allowTrustedPublicClient && !client) {
    const generatedSecret = `public_${crypto.randomBytes(16).toString('hex')}`;
    const { error: trustedClientError } = await supabaseAdmin
      .from('mcp_oauth_clients')
      .upsert(
        {
          client_id,
          client_secret: generatedSecret,
          client_name: 'Trusted Public OAuth Client',
          redirect_uris: [normalizedRedirectUri],
        },
        { onConflict: 'client_id' }
      );

    if (trustedClientError) {
      console.error('Error provisioning trusted public client:', trustedClientError);
      return { error: 'Failed to provision OAuth client' };
    }
  }

  // Parse and validate scopes
  const approvedScopes = validateScopes(scope || '');

  // Generate auth code
  const code = `mcp_code_${crypto.randomBytes(32).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

  const { error: insertError } = await supabaseAdmin
    .from('mcp_oauth_codes')
    .insert({
      code,
      client_id,
      user_id: user.id,
      tenant_id: tenantUser.tenant_id,
      redirect_uri: normalizedRedirectUri,
      scopes: approvedScopes,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      expires_at: expiresAt.toISOString()
    });

  if (insertError) {
    console.error('Error creating auth code:', insertError);
    return { error: 'Failed to generate authorization code' };
  }

  let finalRedirect = `${normalizedRedirectUri}?code=${code}`;
  if (state) {
    finalRedirect += `&state=${encodeURIComponent(state)}`;
  }

  return { redirect: finalRedirect };
}
