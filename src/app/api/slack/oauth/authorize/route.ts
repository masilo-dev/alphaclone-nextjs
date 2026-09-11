import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenant_id') || searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }
    const { user } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin']);

    if (!process.env.SLACK_CLIENT_ID || !process.env.SLACK_REDIRECT_URI) {
      return NextResponse.json(
        { error: 'Slack OAuth is not configured' },
        { status: 500 }
      );
    }

    const admin = createSupabaseAdminClient();
    const { data: stateRow, error: stateError } = await admin.from('oauth_states').insert({
      user_id: user.id,
      tenant_id: tenantId,
      metadata: { provider: 'slack' },
    }).select('id').single();
    if (stateError || !stateRow?.id) throw stateError || new Error('OAuth state could not be created');

    // Build Slack OAuth URL
    const authUrl = new URL('https://slack.com/oauth/v2/authorize');
    
    authUrl.searchParams.set('client_id', process.env.SLACK_CLIENT_ID);
    authUrl.searchParams.set('scope', [
      'channels:read',
      'chat:write',
      'chat:write.public',
      'files:write',
      'users:read',
      'team:read',
      'channels:join',
      'im:write',
      'commands'
    ].join(','));
    
    authUrl.searchParams.set('redirect_uri', process.env.SLACK_REDIRECT_URI);
    authUrl.searchParams.set(
      'state',
      stateRow.id,
    );
    authUrl.searchParams.set('user_scope', [
      'channels:read',
      'users:read',
      'team:read'
    ].join(','));

    return NextResponse.redirect(authUrl.toString());

  } catch (error) {
    console.error('[Slack OAuth] Authorization error:', error);
    return routeErrorResponse(error, 'Slack authorization could not be started', request);
  }
}
