import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClientOrThrow } from '@/lib/apiAuth';
import { syncSuppressionCleanup } from '@/lib/email/suppression';

type SupportedProvider = 'resend' | 'sendgrid' | 'brevo' | 'zoho' | 'gmail';

type ParsedWebhookEvent = {
  provider: SupportedProvider;
  eventType: string;
  providerMessageId: string | null;
  trackingId: string | null;
  eventTimestamp: string | null;
  payload: Record<string, unknown>;
};

function normalizeProvider(value: string): SupportedProvider | null {
  const v = value.trim().toLowerCase();
  if (v === 'resend' || v === 'sendgrid' || v === 'brevo' || v === 'zoho' || v === 'gmail') return v;
  return null;
}

function parseIsoTimestamp(value: unknown): string | null {
  if (typeof value === 'number') {
    const ms = value > 1e12 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const ts = Date.parse(value);
    if (!Number.isNaN(ts)) return new Date(ts).toISOString();
  }
  return null;
}

function parseResendEvent(raw: Record<string, unknown>): ParsedWebhookEvent {
  const data = (raw.data && typeof raw.data === 'object') ? (raw.data as Record<string, unknown>) : raw;
  const providerMessageId = typeof data.email_id === 'string'
    ? data.email_id
    : typeof data.id === 'string'
      ? data.id
      : null;
  const trackingId =
    typeof data.tracking_id === 'string'
      ? data.tracking_id
      : typeof (data as Record<string, unknown>)['custom_args'] === 'object'
        ? String(((data as Record<string, unknown>)['custom_args'] as Record<string, unknown>).tracking_id || '')
        : null;
  return {
    provider: 'resend',
    eventType: String(raw.type || data.event || 'unknown'),
    providerMessageId,
    trackingId: trackingId || null,
    eventTimestamp: parseIsoTimestamp(raw.created_at || data.created_at || raw.timestamp),
    payload: raw,
  };
}

function parseSendgridEvent(raw: Record<string, unknown>): ParsedWebhookEvent {
  const trackingId =
    typeof raw.tracking_id === 'string'
      ? raw.tracking_id
      : typeof raw.unique_args === 'object'
        ? String((raw.unique_args as Record<string, unknown>).tracking_id || '')
        : null;
  return {
    provider: 'sendgrid',
    eventType: String(raw.event || 'unknown'),
    providerMessageId: typeof raw.sg_message_id === 'string' ? raw.sg_message_id : null,
    trackingId: trackingId || null,
    eventTimestamp: parseIsoTimestamp(raw.timestamp),
    payload: raw,
  };
}

function parseBrevoEvent(raw: Record<string, unknown>): ParsedWebhookEvent {
  const trackingId =
    typeof raw.tracking_id === 'string'
      ? raw.tracking_id
      : typeof raw.tags === 'object'
        ? String((raw.tags as Record<string, unknown>).tracking_id || '')
        : null;
  return {
    provider: 'brevo',
    eventType: String(raw.event || raw.message_event || 'unknown'),
    providerMessageId: typeof raw['message-id'] === 'string' ? raw['message-id'] : null,
    trackingId: trackingId || null,
    eventTimestamp: parseIsoTimestamp(raw.date || raw.ts_event || raw.timestamp),
    payload: raw,
  };
}

function parseGenericEvent(provider: SupportedProvider, raw: Record<string, unknown>): ParsedWebhookEvent {
  return {
    provider,
    eventType: String(raw.event || raw.type || 'unknown'),
    providerMessageId: typeof raw.message_id === 'string' ? raw.message_id : null,
    trackingId: typeof raw.tracking_id === 'string' ? raw.tracking_id : null,
    eventTimestamp: parseIsoTimestamp(raw.timestamp || raw.created_at),
    payload: raw,
  };
}

function mapDeliveryStatus(eventType: string): string {
  const e = eventType.toLowerCase();
  if (e.includes('open')) return 'opened';
  if (e.includes('click')) return 'clicked';
  if (e.includes('deliver')) return 'delivered';
  if (e.includes('sent') || e.includes('processed')) return 'sent';
  if (e.includes('bounce') || e.includes('drop') || e.includes('reject') || e.includes('spam') || e.includes('defer') || e.includes('fail')) return 'failed';
  return 'received';
}

function isWebhookAuthorized(req: NextRequest): boolean {
  const token = req.nextUrl.searchParams.get('token') || req.headers.get('x-webhook-token');
  const expected = process.env.EMAIL_WEBHOOK_SHARED_TOKEN;
  if (!expected) return false;
  return Boolean(token) && token === expected;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider: providerParam } = await context.params;
    const provider = normalizeProvider(providerParam);
    if (!provider) {
      return NextResponse.json({ success: false, error: 'Unsupported provider.' }, { status: 400 });
    }
    if (!isWebhookAuthorized(req)) {
      return NextResponse.json({ success: false, error: 'Webhook authorization failed.' }, { status: 401 });
    }

    const admin = createAdminSupabaseClientOrThrow();
    const rawBody = await req.json();
    const eventsArray = Array.isArray(rawBody) ? rawBody : [rawBody];

    const parsedEvents: ParsedWebhookEvent[] = eventsArray
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const raw = item as Record<string, unknown>;
        if (provider === 'resend') return parseResendEvent(raw);
        if (provider === 'sendgrid') return parseSendgridEvent(raw);
        if (provider === 'brevo') return parseBrevoEvent(raw);
        return parseGenericEvent(provider, raw);
      });

    let processed = 0;
    let unmatched = 0;
    for (const event of parsedEvents) {
      let lookup = admin
        .from('lead_outreach_log')
        .select('id, tenant_id, user_id, lead_email')
        .eq('provider', event.provider)
        .order('created_at', { ascending: false })
        .limit(1);
      if (event.providerMessageId) lookup = lookup.eq('provider_message_id', event.providerMessageId);
      else if (event.trackingId) lookup = lookup.eq('tracking_id', event.trackingId);

      const { data: logRow } = await lookup.maybeSingle();
      if (!logRow) {
        unmatched += 1;
        continue;
      }

      const mappedStatus = mapDeliveryStatus(event.eventType);
      const eventTypeLower = event.eventType.toLowerCase();
      const isBounceLike = eventTypeLower.includes('bounce') || eventTypeLower.includes('spam') || eventTypeLower.includes('reject') || eventTypeLower.includes('drop');
      const isFailureLike = eventTypeLower.includes('defer') || eventTypeLower.includes('fail');

      await admin
        .from('email_webhook_events')
        .insert({
          tenant_id: logRow.tenant_id,
          user_id: logRow.user_id,
          provider: event.provider,
          event_type: event.eventType,
          provider_message_id: event.providerMessageId,
          tracking_id: event.trackingId,
          event_timestamp: event.eventTimestamp,
          payload: event.payload,
          processing_status: 'processed',
        });

      const patch: Record<string, unknown> = {
        provider_event_status: mappedStatus,
        provider_last_event_at: event.eventTimestamp || new Date().toISOString(),
      };
      if (mappedStatus === 'delivered' || mappedStatus === 'sent') patch.status = 'sent';
      if (mappedStatus === 'opened') patch.opened_at = event.eventTimestamp || new Date().toISOString();
      if (mappedStatus === 'clicked') patch.clicked_at = event.eventTimestamp || new Date().toISOString();
      if (isBounceLike) {
        patch.status = 'bounced';
        patch.provider_event_status = 'bounced';
        patch.error_message = `Provider webhook reported bounce (${event.eventType}).`;
      } else if (eventTypeLower.includes('unsubscribe')) {
        patch.status = 'unsubscribed';
        patch.provider_event_status = 'unsubscribed';
        patch.error_message = `Recipient unsubscribed (${event.eventType}).`;
      } else if (isFailureLike || mappedStatus === 'failed') {
        patch.status = 'failed';
        patch.error_message = `Provider webhook reported failure (${event.eventType}).`;
      }

      await admin
        .from('lead_outreach_log')
        .update(patch)
        .eq('tenant_id', logRow.tenant_id)
        .eq('id', logRow.id);

      if (isBounceLike || eventTypeLower.includes('unsubscribe')) {
        await syncSuppressionCleanup({
          tenantId: logRow.tenant_id,
          email: String(logRow.lead_email || '').trim(),
          reason: eventTypeLower.includes('unsubscribe') ? 'unsubscribe' : 'bounce',
          provider: event.provider,
          eventId: event.providerMessageId || event.trackingId || undefined,
          metadata: event.payload,
        });
      }

      processed += 1;
    }

    return NextResponse.json({
      success: true,
      provider,
      received: parsedEvents.length,
      processed,
      unmatched,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
