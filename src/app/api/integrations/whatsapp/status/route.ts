import { NextResponse } from 'next/server';
import { ENV } from '@/config/env';

export async function GET() {
  return NextResponse.json({
    metaConfigured: !!(ENV.FACEBOOK_VERIFY_TOKEN && ENV.FACEBOOK_APP_SECRET),
    provider: 'meta',
  });
}
