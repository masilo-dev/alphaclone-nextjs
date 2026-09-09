import { NextRequest, NextResponse } from 'next/server';
import { runNotificationDigests } from '@/lib/email/notificationDigestEngine';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  return NextResponse.json({ status: 'ok', ...(await runNotificationDigests()) });
}
