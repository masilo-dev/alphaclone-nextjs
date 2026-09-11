import { NextRequest, NextResponse } from 'next/server';
import { runNotificationDigests } from '@/lib/email/notificationDigestEngine';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const denied = denyIfCronUnauthorized(request);
  if (denied) return denied;
  try {
    return NextResponse.json(await runNotificationDigests());
  } catch (error) {
    console.error('[notification-digests] worker failed:', error);
    return NextResponse.json({ error: 'Digest worker failed' }, { status: 500 });
  }
}
