import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { upsertNativeBookingFromProvider } from '@/lib/booking/nativeBookingSync';

function verifyCalWebhook(req: Request, body: string) {
  const secret = process.env.CAL_WEBHOOK_SECRET || process.env.CALCOM_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[Cal webhook] CAL_WEBHOOK_SECRET not set - accepting webhook in unsigned mode.');
    return true;
  }

  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const sharedSecret = req.headers.get('x-alphaclone-webhook-secret') || req.headers.get('x-cal-webhook-secret');
  if (bearer === secret || sharedSecret === secret) return true;

  const signature =
    req.headers.get('x-cal-signature-256') ||
    req.headers.get('x-cal-signature') ||
    req.headers.get('cal-signature');
  if (!signature) return false;

  const received = signature.replace(/^sha256=/i, '');
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function normalizeCalPayload(raw: any) {
  const payload = raw?.payload || raw?.data || raw;
  const eventType = pickString(raw?.triggerEvent, raw?.event, raw?.type);
  const status = eventType.toLowerCase().includes('cancel') ? 'cancelled' : 'confirmed';
  const attendee = Array.isArray(payload?.attendees) ? payload.attendees[0] : payload?.attendee || payload?.invitee;
  const eventTypeObject = payload?.eventType || payload?.event_type;

  return {
    tenantId: pickString(
      payload?.metadata?.tenant_id,
      payload?.metadata?.tenantId,
      payload?.responses?.tenant_id?.value,
      payload?.tenant_id,
      raw?.tenant_id
    ),
    providerBookingId: pickString(payload?.uid, payload?.id, payload?.bookingId, payload?.booking_id),
    providerEventTypeId: pickString(eventTypeObject?.id, payload?.eventTypeId, payload?.event_type_id),
    bookingTypeName: pickString(eventTypeObject?.title, eventTypeObject?.name, payload?.title, payload?.eventTitle),
    clientName: pickString(attendee?.name, payload?.name, payload?.responses?.name?.value),
    clientEmail: pickString(attendee?.email, payload?.email, payload?.responses?.email?.value),
    clientPhone: pickString(attendee?.phoneNumber, attendee?.phone, payload?.phone, payload?.responses?.phone?.value),
    clientNotes: pickString(payload?.description, payload?.notes, payload?.responses?.notes?.value),
    startTime: pickString(payload?.startTime, payload?.start_time, payload?.start),
    endTime: pickString(payload?.endTime, payload?.end_time, payload?.end),
    timeZone: pickString(payload?.timeZone, payload?.timezone, attendee?.timeZone),
    meetingUrl: pickString(payload?.meetingUrl, payload?.location, payload?.videoCallUrl),
    status,
    fullPayload: raw,
  };
}

async function resolveTenantId(supabase: ReturnType<typeof createSupabaseAdminClient>, normalized: ReturnType<typeof normalizeCalPayload>) {
  if (normalized.tenantId) return normalized.tenantId;

  if (normalized.providerEventTypeId) {
    const { data } = await supabase
      .from('tenants')
      .select('id')
      .or(`cal_event_type_id.eq.${normalized.providerEventTypeId},cal_team_id.eq.${normalized.providerEventTypeId}`)
      .maybeSingle();
    if (data?.id) return String(data.id);
  }

  return '';
}

export async function POST(req: Request) {
  const body = await req.text();
  if (!verifyCalWebhook(req, body)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const raw = JSON.parse(body || '{}');
  const normalized = normalizeCalPayload(raw);
  const supabase = createSupabaseAdminClient();
  const tenantId = await resolveTenantId(supabase, normalized);

  if (!tenantId || !normalized.clientEmail || !normalized.startTime || !normalized.endTime) {
    return NextResponse.json({ error: 'Missing booking tenant or attendee details' }, { status: 400 });
  }

  const booking = await upsertNativeBookingFromProvider(supabase, {
    tenantId,
    clientName: normalized.clientName || normalized.clientEmail,
    clientEmail: normalized.clientEmail,
    clientPhone: normalized.clientPhone || null,
    clientNotes: normalized.clientNotes || null,
    startTime: normalized.startTime,
    endTime: normalized.endTime,
    timeZone: normalized.timeZone || null,
    status: normalized.status as any,
    source: raw?.source === 'cal_diy' ? 'cal_diy' : 'cal_cloud',
    providerBookingId: normalized.providerBookingId || null,
    providerEventTypeId: normalized.providerEventTypeId || null,
    meetingUrl: normalized.meetingUrl || null,
    bookingTypeName: normalized.bookingTypeName || 'Meeting',
    metadata: { cal_webhook_payload: normalized.fullPayload },
  });

  return NextResponse.json({ success: true, bookingId: booking?.id });
}
