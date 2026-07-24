import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ENV } from '@/config/env';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { publicAppUrl } from '@/lib/config/public-origin';

export async function GET(req: NextRequest) {
    try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
        return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    const { user } = await requireTenantRole(tenantId, ['owner','admin','tenant_admin','super_admin']);

    const clientId = ENV.VITE_CALENDLY_CLIENT_ID;
    const redirectUri = ENV.VITE_CALENDLY_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        return NextResponse.redirect(
          publicAppUrl('/dashboard/settings?tab=booking&error=calendly_not_configured')
        );
    }

    const admin = createSupabaseAdminClient();
    const { data: stateRow, error: stateError } = await admin.from('oauth_states').insert({
        user_id: user.id, tenant_id: tenantId, metadata: { provider: 'calendly' },
    }).select('id').single();
    if (stateError || !stateRow?.id) throw stateError || new Error('OAuth state could not be created');

    const authUrl = `https://auth.calendly.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${stateRow.id}`;

    return NextResponse.redirect(authUrl);
    } catch (err) {
        console.error('[calendly/connect] GET error:', err);
        return routeErrorResponse(err, 'Calendly authorization could not be started', req);
    }
}
