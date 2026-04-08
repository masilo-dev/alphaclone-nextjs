import { NextRequest, NextResponse } from 'next/server';

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

    if (!process.env.SLACK_CLIENT_ID || !process.env.SLACK_REDIRECT_URI) {
      return NextResponse.json(
        { error: 'Slack OAuth is not configured' },
        { status: 500 }
      );
    }

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
    authUrl.searchParams.set('state', tenantId);
    authUrl.searchParams.set('user_scope', [
      'channels:read',
      'users:read',
      'team:read'
    ].join(','));

    return NextResponse.redirect(authUrl.toString());

  } catch (error) {
    console.error('[Slack OAuth] Authorization error:', error);
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    );
  }
}
