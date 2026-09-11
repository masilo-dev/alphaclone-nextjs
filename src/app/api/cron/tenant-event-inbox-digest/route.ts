import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { runTenantEventInboxDigest } from '@/lib/notifications/runTenantEventInboxDigest';

export const dynamic = 'force-dynamic';

/** Consumes pending tenant_business_event_inbox rows into digest emails */
export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  try {
    const result = await runTenantEventInboxDigest();
    return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Tenant inbox digest failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
