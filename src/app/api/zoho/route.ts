import { NextRequest, NextResponse } from 'next/server';

const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID || '1000.EHLUECNTL7GYIS34VV79J1KDPBCFWK';
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET || '8f666879e8d327eb32e834877cfcc1789663484cf4';
const ZOHO_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/zoho/callback`;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      return NextResponse.json({ error: 'Authorization code required' }, { status: 400 });
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: ZOHO_CLIENT_ID,
        client_secret: ZOHO_CLIENT_SECRET,
        code: code,
        redirect_uri: ZOHO_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return NextResponse.json({ 
        error: 'Failed to exchange code for token', 
        details: tokenData 
      }, { status: tokenResponse.status });
    }

    // Store the tokens securely (you'll need to implement secure storage)
    // For now, we'll return them in the response
    return NextResponse.json({
      success: true,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      api_domain: tokenData.api_domain,
      token_type: tokenData.token_type,
    });

  } catch (error) {
    console.error('Zoho OAuth error:', error);
    return NextResponse.json({ 
      error: 'Internal server error during OAuth flow',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, access_token, ...data } = await request.json();

    if (!access_token) {
      return NextResponse.json({ error: 'Access token required' }, { status: 400 });
    }

    let response;

    switch (action) {
      case 'get_leads':
        response = await fetch('https://www.zohoapis.com/crm/v2/Leads', {
          headers: {
            'Authorization': `Zoho-oauthtoken ${access_token}`,
            'Content-Type': 'application/json',
          },
        });
        break;

      case 'create_lead':
        response = await fetch('https://www.zohoapis.com/crm/v2/Leads', {
          method: 'POST',
          headers: {
            'Authorization': `Zoho-oauthtoken ${access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: [data.lead]
          }),
        });
        break;

      case 'send_email':
        response = await fetch('https://www.zohoapis.com/crm/v2/Emails', {
          method: 'POST',
          headers: {
            'Authorization': `Zoho-oauthtoken ${access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: [data.email]
          }),
        });
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json({ 
        error: `Zoho API error: ${response.statusText}`,
        details: result 
      }, { status: response.status });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Zoho API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}