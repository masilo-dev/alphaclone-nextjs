// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getAuthenticatedUser(request: Request) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: {
          Authorization: request.headers.get('Authorization') ?? '',
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Unauthorized');
  }

  return user;
}

function isServiceRoleRequest(request: Request) {
  const auth = request.headers.get('Authorization') ?? '';
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return Boolean(serviceRole) && auth === `Bearer ${serviceRole}`;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const serviceMode = isServiceRoleRequest(request);
    const user = serviceMode ? null : await getAuthenticatedUser(request);
    const userId = serviceMode ? body.userId : user?.id;

    if (!userId) {
      throw new Error('userId is required');
    }

    const params = new URLSearchParams({
      client_id: Deno.env.get('AZURE_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('AZURE_CLIENT_SECRET') ?? '',
      grant_type: 'refresh_token',
      refresh_token: '',
    });

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const refreshToken =
      body.refreshToken ||
      (await admin
        .from('microsoft_connections')
        .select('refresh_token')
        .eq('user_id', userId)
        .maybeSingle()
        .then(({ data }) => data?.refresh_token));

    if (!refreshToken) {
      throw new Error('refreshToken is required');
    }

    params.set('refresh_token', refreshToken);

    const tokenResponse = await fetch(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      }
    );

    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(tokenPayload.error_description || 'Failed to refresh Microsoft token.');
    }

    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
      },
    });
    const profile = await profileResponse.json();

    const expiresAt = tokenPayload.expires_in
      ? new Date(Date.now() + Number(tokenPayload.expires_in) * 1000).toISOString()
      : null;

    const { data, error } = await admin
      .from('microsoft_connections')
      .update({
        access_token: tokenPayload.access_token,
        refresh_token: tokenPayload.refresh_token || refreshToken,
        token_expiry: expiresAt,
        microsoft_email: profile.mail || profile.userPrincipalName || null,
        display_name: profile.displayName || null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return Response.json(
      { success: true, connection: data },
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unexpected token refresh error' },
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
