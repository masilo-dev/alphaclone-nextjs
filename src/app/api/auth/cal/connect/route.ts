import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ENV } from '@/config/env';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { publicAppUrl } from '@/lib/config/public-origin';
import { CALCOM_BASE_URL } from '@/services/calcom/calcomIntegrationService';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const { user } = await requireTenantRole(
      tenantId,
      ['owner', 'admin', 'tenant_admin', 'super_admin'],
      req
    );

    const clientId = ENV.CAL_OAUTH_CLIENT_ID;
    const redirectUri =
      ENV.CAL_OAUTH_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com'}/api/auth/cal/callback`;

    if (!clientId) {
      return NextResponse.redirect(
        publicAppUrl('/dashboard/settings?tab=booking&error=calcom_not_configured')
      );
    }

    // Store OAuth state
    const admin = createSupabaseAdminClient();
    const { data: stateRow, error: stateError } = await admin
      .from('oauth_states')
      .insert({
        user_id: user.id,
        tenant_id: tenantId,
        metadata: { provider: 'calcom', redirect_uri: redirectUri },
      })
      .select('id')
      .single();

    if (stateError || !stateRow?.id) {
      throw stateError || new Error('OAuth state could not be created');
    }

    // Cal.com authorize URL
    const authUrl = new URL(`${CALCOM_BASE_URL}/oauth/authorize`);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', stateRow.id);
    // Comprehensive Cal.com OAuth v2 scopes (User, Team, Organization)
    const calScopes = [
      // User level
      'READ_ME', 'READ_PROFILE', 'WRITE_PROFILE',
      'READ_EVENT_TYPE', 'WRITE_EVENT_TYPE',
      'READ_BOOKING', 'WRITE_BOOKING',
      'READ_AVAILABILITY', 'WRITE_AVAILABILITY',
      'READ_APPS', 'WRITE_APPS',
      'READ_WEBHOOK', 'WRITE_WEBHOOK',
      'READ_INSIGHTS',

      // Team level
      'READ_TEAM', 'WRITE_TEAM',
      'READ_TEAM_EVENT_TYPE', 'WRITE_TEAM_EVENT_TYPE',
      'READ_TEAM_BOOKING', 'WRITE_TEAM_BOOKING',
      'READ_TEAM_SCHEDULE', 'WRITE_TEAM_SCHEDULE',
      'READ_TEAM_MEMBERSHIP', 'WRITE_TEAM_MEMBERSHIP',

      // Org level
      'READ_ORG', 'WRITE_ORG',
      'READ_ORG_BOOKING', 'WRITE_ORG_BOOKING',
      'READ_ORG_SCHEDULE', 'WRITE_ORG_SCHEDULE'
    ];

    authUrl.searchParams.set('scope', calScopes.join(' '));

    return NextResponse.redirect(authUrl.toString());
  } catch (err) {
    console.error('[cal/connect] GET error:', err);
    return routeErrorResponse(err, 'Cal.com authorization could not be started', req);
  }
}
