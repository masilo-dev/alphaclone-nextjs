import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { ENV } from '@/config/env';

export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
        return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    // Verify user has access to this tenant
    const { data: access } = await supabase.rpc('user_has_tenant_access', {
        p_user_id: user.id,
        p_tenant_id: tenantId
    });

    if (!access) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const clientId = ENV.VITE_CALENDLY_CLIENT_ID;
    const redirectUri = ENV.VITE_CALENDLY_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        return NextResponse.json({ error: 'Calendly OAuth is not configured' }, { status: 500 });
    }

    // Create state to keep track of tenantId
    const state = Buffer.from(JSON.stringify({ tenantId })).toString('base64');

    const authUrl = `https://auth.calendly.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    return NextResponse.redirect(authUrl);
}
