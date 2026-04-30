import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '../../../../config/env';


export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { redirect_uri, state, user_id } = body;
        
        if (!user_id || !redirect_uri) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

        // Fetch user's tenant_id if not known
        const { data: tenantUser } = await supabaseAdmin
            .from('tenant_users')
            .select('tenant_id')
            .eq('user_id', user_id)
            .single();
            
        const tenant_id = tenantUser?.tenant_id;
        
        if (!tenant_id) {
            return NextResponse.json({ error: 'No workspace found for your account' }, { status: 403 });
        }

        // Generate an API Key (which acts as both the OAuth code and the access token)
        const apiKey = `mcp_${crypto.randomUUID().replace(/-/g, '')}`;
        
        const { error: insertError } = await supabaseAdmin
            .from('mcp_api_keys')
            .insert({
                api_key: apiKey,
                tenant_id,
                user_id,
                name: 'Claude Desktop (OAuth)',
            });
            
        if (insertError) {
            console.error('Error generating MCP API key:', insertError);
            return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
        }
        
        // Redirect back to Claude with the API key as the "code"
        const url = new URL(redirect_uri);
        url.searchParams.set('code', apiKey);
        if (state) {
            url.searchParams.set('state', state);
        }
        
        return NextResponse.json({ redirectUrl: url.toString() });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}
