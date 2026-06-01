// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getAuthenticatedUser(request: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: request.headers.get('Authorization') ?? '',
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Unauthorized');
  }

  return user;
}

async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const clientId = Deno.env.get('AZURE_CLIENT_ID') ?? '';
  const clientSecret = Deno.env.get('AZURE_CLIENT_SECRET') ?? '';

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(
    'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error_description || 'Failed to exchange Microsoft code.');
  }

  return payload;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const user = await getAuthenticatedUser(request);
    const { code, redirectUri } = await request.json();
    if (!code || !redirectUri) {
      throw new Error('code and redirectUri are required');
    }

    const tokenPayload = await exchangeCodeForTokens(code, redirectUri);
    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
      },
    });
    const profile = await profileResponse.json();

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const expiresAt = tokenPayload.expires_in
      ? new Date(Date.now() + Number(tokenPayload.expires_in) * 1000).toISOString()
      : null;

    const { data, error } = await admin
      .from('microsoft_connections')
      .upsert(
        {
          user_id: user.id,
          access_token: tokenPayload.access_token,
          refresh_token: tokenPayload.refresh_token,
          token_expiry: expiresAt,
          microsoft_email: profile.mail || profile.userPrincipalName || user.email,
          display_name: profile.displayName || user.user_metadata?.name || user.email,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
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
      { error: error instanceof Error ? error.message : 'Unexpected Microsoft OAuth error' },
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
