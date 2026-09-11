import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { enqueueBookingAutomationJobs } from '@/lib/booking/bookingAutomation';

export type NativeBookingInput = {
  tenantId: string;
  hostUserId?: string | null;
  bookingTypeId?: string | null;
  bookingTypeName?: string | null;
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  clientNotes?: string | null;
  startTime: string;
  endTime: string;
  timeZone?: string | null;
  status?: 'confirmed' | 'cancelled' | 'canceled' | 'rescheduled' | 'missed' | 'completed';
  source: 'native' | 'cal_cloud' | 'cal_diy' | 'calendly';
  providerBookingId?: string | null;
  providerEventTypeId?: string | null;
  meetingUrl?: string | null;
  metadata?: Record<string, unknown>;
};

function safeStatus(status: NativeBookingInput['status']) {
  if (status === 'cancelled' || status === 'canceled') return 'cancelled';
  if (status === 'missed') return 'no_show';
  if (status === 'completed') return 'completed';
  return 'confirmed';
}

export async function resolveTenantHostUser(
  supabase: SupabaseClient,
  tenantId: string,
  preferredHostUserId?: string | null
) {
  if (preferredHostUserId) return preferredHostUserId;

  const { data } = await supabase
    .from('tenant_users')
    .select('user_id, role')
    .eq('tenant_id', tenantId);

  const host = data?.find((u: any) => ['owner', 'admin', 'tenant_admin', 'super_admin'].includes(u.role)) || data?.[0];
  return host?.user_id ? String(host.user_id) : null;
}

export async function upsertNativeBookingFromProvider(
  supabase: SupabaseClient,
  input: NativeBookingInput
) {
  const hostUserId = await resolveTenantHostUser(supabase, input.tenantId, input.hostUserId);
  const status = safeStatus(input.status);
  const providerMetadata = {
    ...(input.metadata || {}),
    source: input.source,
    provider_booking_id: input.providerBookingId || null,
    provider_event_type_id: input.providerEventTypeId || null,
    meeting_url: input.meetingUrl || null,
  };

  let leadId: string | null = null;
  const { data: existingLead } = await supabase
    .from('leads')
    .select('id')
    .eq('tenant_id', input.tenantId)
    .eq('email', input.clientEmail)
    .maybeSingle();

  if (existingLead?.id) {
    leadId = String(existingLead.id);
  } else {
    const { data: newLead } = await supabase
      .from('leads')
      .insert({
        tenant_id: input.tenantId,
        business_name: input.clientName,
        name: input.clientName,
        email: input.clientEmail,
        phone: input.clientPhone || null,
        stage: 'lead',
        status: 'new',
        source: input.source === 'native' ? 'Inbound Booking' : 'Calendar Booking',
        notes: input.clientNotes || null,
        metadata: providerMetadata,
      })
      .select('id')
      .maybeSingle();
    if (newLead?.id) leadId = String(newLead.id);
  }

  let calendarEventId: string | null = null;
  if (hostUserId) {
    const { data: event } = await supabase
      .from('calendar_events')
      .insert({
        tenant_id: input.tenantId,
        user_id: hostUserId,
        title: `Booking: ${input.bookingTypeName || 'Meeting'} with ${input.clientName}`,
        description: input.clientNotes || 'Booking created from the white-label booking system.',
        start_time: input.startTime,
        end_time: input.endTime,
        type: 'meeting',
        related_to_lead: leadId,
        is_all_day: false,
        reminder_minutes: 15,
        metadata: providerMetadata,
      })
      .select('id')
      .maybeSingle();
    if (event?.id) calendarEventId = String(event.id);

    await supabase.from('tasks').insert({
      tenant_id: input.tenantId,
      assigned_to: hostUserId,
      title: `Prepare for meeting with ${input.clientName}`,
      description: `Review lead details before the booked session. Notes: ${input.clientNotes || ''}`,
      due_date: input.startTime,
      status: 'pending',
      priority: 'high',
      related_to_lead: leadId,
    });
  }

  let bookingQuery = supabase
    .from('bookings')
    .select('id')
    .eq('tenant_id', input.tenantId);

  if (input.providerBookingId) {
    bookingQuery = bookingQuery.filter('metadata->>provider_booking_id', 'eq', input.providerBookingId);
  } else {
    bookingQuery = bookingQuery
      .eq('client_email', input.clientEmail)
      .eq('start_time', input.startTime);
  }

  const { data: existingBooking } = await bookingQuery.maybeSingle();
  const bookingPayload = {
    tenant_id: input.tenantId,
    booking_type_id: input.bookingTypeId || null,
    client_name: input.clientName,
    client_email: input.clientEmail,
    client_phone: input.clientPhone || null,
    client_notes: input.clientNotes || null,
    start_time: input.startTime,
    end_time: input.endTime,
    time_zone: input.timeZone || null,
    status,
    calendar_event_id: calendarEventId,
    metadata: providerMetadata,
  };

  const bookingResult = existingBooking?.id
    ? await supabase.from('bookings').update(bookingPayload).eq('id', existingBooking.id).select('*').single()
    : await supabase.from('bookings').insert(bookingPayload).select('*').single();

  if (bookingResult.error) throw bookingResult.error;

  await enqueueBookingAutomationJobs(supabase, {
    tenantId: input.tenantId,
    bookingId: String(bookingResult.data.id),
    bookingTypeName: input.bookingTypeName || 'Meeting',
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    clientNotes: input.clientNotes || null,
    startTime: input.startTime,
    endTime: input.endTime,
    timeZone: input.timeZone || null,
    meetingUrl: input.meetingUrl || null,
    hostUserId,
    source: input.source,
  });

  return bookingResult.data;
}

async function sendBookingEmails(
  supabase: SupabaseClient,
  input: Omit<NativeBookingInput, 'status'> & { hostUserId: string | null; status: string }
) {
  if (input.status !== 'confirmed') return;

  const when = new Date(input.startTime).toLocaleString('en-US', {
    timeZone: input.timeZone || 'UTC',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  await sendEmailServer({
    tenantId: input.tenantId,
    to: input.clientEmail,
    subject: `Confirmation: ${input.bookingTypeName || 'Meeting'} on ${when}`,
    templateName: 'bookingConfirmation',
    html: `
      <div style="font-family:Arial,sans-serif;padding:24px;color:#0f172a;">
        <h1 style="margin:0 0 16px;">Booking Confirmed</h1>
        <p>Hi <strong>${input.clientName}</strong>, your session for <strong>${input.bookingTypeName || 'Meeting'}</strong> is confirmed.</p>
        <p><strong>When:</strong> ${when}${input.timeZone ? ` (${input.timeZone})` : ''}</p>
        ${input.meetingUrl ? `<p><a href="${input.meetingUrl}" style="display:inline-block;padding:12px 18px;background:#0d9488;color:#fff;text-decoration:none;border-radius:8px;">Join meeting</a></p>` : ''}
      </div>
    `,
  });

  if (!input.hostUserId) return;
  const { data: hostProfile } = await supabase
    .from('profiles')
    .select('email, name')
    .eq('id', input.hostUserId)
    .maybeSingle();

  if (!hostProfile?.email) return;
  await sendEmailServer({
    tenantId: input.tenantId,
    to: hostProfile.email,
    subject: `New booking: ${input.clientName} - ${input.bookingTypeName || 'Meeting'}`,
    isPlatformNotification: true,
    html: `
      <div style="font-family:Arial,sans-serif;padding:24px;color:#0f172a;">
        <h2>New client booking</h2>
        <p><strong>${input.clientName}</strong> (${input.clientEmail}) booked <strong>${input.bookingTypeName || 'Meeting'}</strong>.</p>
        <p><strong>When:</strong> ${when}</p>
        ${input.meetingUrl ? `<p><a href="${input.meetingUrl}">Open meeting</a></p>` : ''}
        ${input.clientNotes ? `<p><strong>Notes:</strong> ${input.clientNotes}</p>` : ''}
      </div>
    `,
  });
}
