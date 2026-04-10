import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { client_name, redirect_uris } = body;

    if (!client_name || typeof client_name !== 'string') {
      return NextResponse.json({ error: 'invalid_client_metadata', error_description: 'client_name is required' }, { status: 400 });
    }

    if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      return NextResponse.json({ error: 'invalid_client_metadata', error_description: 'redirect_uris is required and must be an array' }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const clientSecret = crypto.randomBytes(32).toString('hex');
    
    // In production, you might want to hash this secret before storing,
    // but for OAuth basic use-cases and this implementation, storing securely is okay.
    const { data: client, error } = await supabaseAdmin
      .from('mcp_oauth_clients')
      .insert({
        client_name,
        client_secret: clientSecret,
        redirect_uris
      })
      .select('client_id')
      .single();

    if (error || !client) {
      console.error('Error registering client:', error);
      return NextResponse.json({ error: 'server_error' }, { status: 500 });
    }

    return NextResponse.json({
      client_id: client.client_id,
      client_secret: clientSecret,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name,
      redirect_uris,
      token_endpoint_auth_method: 'client_secret_post'
    }, { status: 201 });

  } catch (error) {
    console.error('DCR parsing error:', error);
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
}
