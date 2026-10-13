import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureNativeBookingDefaults } from '@/lib/tenant/bootstrapTenantServer';
import { enqueueBookingAutomationJobs, processDueBookingAutomationJobs, type BookingAutomationContext } from './bookingAutomation';

/** Native bookings use the same durable confirmations on first creation and retries. */
export async function confirmNativeBooking(admin: SupabaseClient, slug: string, context: BookingAutomationContext) {
  await ensureNativeBookingDefaults(admin, context.tenantId, slug);
  await enqueueBookingAutomationJobs(admin, context);
  return processDueBookingAutomationJobs(admin, 10, { tenantId: context.tenantId, bookingId: context.bookingId });
}
