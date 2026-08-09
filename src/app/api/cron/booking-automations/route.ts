import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { processDueBookingAutomationJobs } from '@/lib/booking/bookingAutomation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  try {
    const result = await processDueBookingAutomationJobs(createSupabaseAdminClient(), 50);
    return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[cron/booking-automations]', error);
    return NextResponse.json({ success: false, error: 'Booking automation processing failed' }, { status: 500 });
  }
}
