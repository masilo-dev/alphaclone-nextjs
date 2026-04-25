import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  if (host) return `${proto}://${host}`;
  return ENV.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com';
}

function buildPayload(baseUrl: string) {
  const normalized = baseUrl.replace(/\/+$/, '');
  return {
    resource: normalized,
    resource_metadata: `${normalized}/.well-known/oauth-protected-resource`,
    authorization_servers: [normalized],
    bearer_methods_supported: ['header', 'query'],
    scopes_supported: ['read', 'write'],
  };
}

export async function GET(req: NextRequest) {
  const baseUrl = getBaseUrl(req);
  return NextResponse.json(buildPayload(baseUrl), {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
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
