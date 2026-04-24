import { NextResponse } from 'next/server';
import { ENV } from '@/config/env';

export async function GET() {
  const baseUrl = ENV.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com';

  return NextResponse.json(
    {
      resource: baseUrl,
      resource_metadata: `${baseUrl}/.well-known/oauth-protected-resource`,
      authorization_servers: [baseUrl],
      bearer_methods_supported: ['header', 'query'],
      scopes_supported: ['read', 'write'],
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    }
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
