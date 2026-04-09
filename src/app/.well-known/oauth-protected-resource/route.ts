import { NextResponse } from 'next/server';
import { ENV } from '@/config/env';

export async function GET() {
  const baseUrl = ENV.NEXT_PUBLIC_APP_URL || 'https://alphaclone.tech';
  
  return NextResponse.json({
    "resource": baseUrl,
    "authorization_servers": [
      baseUrl
    ]
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    }
  });
}
