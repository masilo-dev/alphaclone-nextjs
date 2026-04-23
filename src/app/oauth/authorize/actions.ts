'use server';

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import crypto from 'crypto';
import { validateScopes } from '@/services/mcp/MCPOAuthScopes';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  if (!client_id || !redirect_uri) {
    return { error: 'Missing client_id or redirect_uri' };
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

  if (!client || !client.redirect_uris.includes(redirect_uri)) {
    const clientLooksLikeTenantId = UUID_V4_REGEX.test(client_id) && client_id === tenantUser.tenant_id;
    if (!(clientLooksLikeTenantId && isTrustedPublicRedirectUri(redirect_uri))) {
      return { error: 'Invalid client_id or redirect_uri mismatch' };
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
      redirect_uri,
      scopes: approvedScopes,
      expires_at: expiresAt.toISOString()
    });

  if (insertError) {
    console.error('Error creating auth code:', insertError);
    return { error: 'Failed to generate authorization code' };
  }

  let finalRedirect = `${redirect_uri}?code=${code}`;
  if (state) {
    finalRedirect += `&state=${encodeURIComponent(state)}`;
  }

  return { redirect: finalRedirect };
}
