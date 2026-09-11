import { NextRequest, NextResponse } from 'next/server';
import { ZohoService } from '../../../../../services/zoho/ZohoService';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { PUBLIC_APP_ORIGIN } from '@/lib/config/public-origin';
import { OAUTH_CALLBACKS } from '@/lib/config/oauth-callbacks';

function getAppUrl(_req: NextRequest) {
    return PUBLIC_APP_ORIGIN;
}

function getZohoRedirectUri(_req: NextRequest) {
    const configured = String(ENV.ZOHO_REDIRECT_URI || '').trim();
    if (configured) return configured.replace(/\/$/, '');
    return OAUTH_CALLBACKS.zoho;
}

function resolveZohoCredentials(region: string): { clientId: string; clientSecret: string } {
    const normalizedRegion = (region || 'US').toUpperCase();
    const regionClientId = (ENV as Record<string, unknown>)[`ZOHO_CLIENT_ID_${normalizedRegion}`];
    const regionClientSecret = (ENV as Record<string, unknown>)[`ZOHO_CLIENT_SECRET_${normalizedRegion}`];
    const clientId = String(regionClientId || ENV.ZOHO_CLIENT_ID || '').trim();
    const clientSecret = String(regionClientSecret || ENV.ZOHO_CLIENT_SECRET || '').trim();
    return { clientId, clientSecret };
}

export async function GET(req: NextRequest) {
    try {
    const { searchParams } = new URL(req.url);
    const requestedRegion = searchParams.get('region');
    const tenantId = searchParams.get('tenantId') || searchParams.get('tenant_id') || '';

    const redirectUri = getZohoRedirectUri(req);

    const { user } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin']);

    const region = (requestedRegion || ENV.ZOHO_REGION || 'US').toUpperCase();
    const { clientId, clientSecret } = resolveZohoCredentials(region);
    if (!clientId || !clientSecret) {
        return NextResponse.json(
            { error: `Zoho OAuth credentials are missing for region ${region}` },
            { status: 500 }
        );
    }
    const hosts = ZohoService.getHostsByRegion(region);
    const admin = createSupabaseAdminClient();
    const { data: stateRow, error: stateError } = await admin.from('oauth_states').insert({
        user_id: user.id,
        tenant_id: tenantId,
        metadata: { provider: 'zoho', region },
    }).select('id').single();
    if (stateError || !stateRow?.id) throw stateError || new Error('OAuth state could not be created');

    const scopes = [
        // Mail
        'ZohoMail.accounts.READ',
        'ZohoMail.messages.ALL',
        'ZohoMail.folders.READ',
        // CRM
        'ZohoCRM.modules.ALL',
        'ZohoCRM.users.READ',
        // Books (finance)
        'ZohoBooks.fullaccess.all',
        // Campaigns (native marketing module)
        'ZohoCampaigns.campaign.ALL',
        'ZohoCampaigns.contact.ALL',
    ];

    const authUrl = new URL(`${hosts.accounts}/oauth/v2/auth`);
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');
    // Zoho requires multiple OAuth scopes to be comma-separated.
    authUrl.searchParams.append('scope', scopes.join(','));
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append(
        'state',
        stateRow.id
    );

    return NextResponse.redirect(authUrl.toString());
    } catch (err) {
        console.error('[zoho/connect] GET error:', err);
        return routeErrorResponse(err, 'Zoho authorization could not be started', req);
    }
}
