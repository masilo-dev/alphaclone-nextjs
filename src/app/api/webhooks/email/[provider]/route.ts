import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClientOrThrow } from '@/lib/apiAuth';
<<<<<<< HEAD
import { syncSuppressionCleanup } from '@/lib/email/suppression';
=======
>>>>>>> origin/main

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
<<<<<<< HEAD
    const affectedCampaigns = new Set<string>(); // `${tenantId}:${campaignId}`
    for (const event of parsedEvents) {
      const eventTypeLower = event.eventType.toLowerCase();
      const mappedStatus = mapDeliveryStatus(event.eventType);
      const isBounceLike = eventTypeLower.includes('bounce') || eventTypeLower.includes('spam') || eventTypeLower.includes('reject') || eventTypeLower.includes('drop');
      const isFailureLike = eventTypeLower.includes('defer') || eventTypeLower.includes('fail');

      // 1) Prefer campaign recipient reconciliation (campaign sends)
      //    We match by provider_message_id stored at send time.
      let matchedCampaignRecipient:
        | {
            id: string;
            tenant_id: string;
            campaign_id: string;
            email: string | null;
            status: string | null;
            sent_at: string | null;
            delivered_at: string | null;
            opened_at: string | null;
            first_opened_at: string | null;
            open_count: number | null;
            clicked_at: string | null;
            click_count: number | null;
            bounced_at: string | null;
            bounce_reason: string | null;
            unsubscribed_at: string | null;
            error_message: string | null;
          }
        | null = null;

      if (event.providerMessageId) {
        const { data: cr } = await admin
          .from('campaign_recipients')
          .select(
            'id, tenant_id, campaign_id, email, status, sent_at, delivered_at, opened_at, first_opened_at, open_count, clicked_at, click_count, bounced_at, bounce_reason, unsubscribed_at, error_message'
          )
          .eq('provider_message_id', event.providerMessageId)
          .maybeSingle();
        if (cr) matchedCampaignRecipient = cr as any;
      }

      if (matchedCampaignRecipient) {
        const nowIso = event.eventTimestamp || new Date().toISOString();
        await admin.from('email_webhook_events').insert({
          tenant_id: matchedCampaignRecipient.tenant_id,
          user_id: null,
          provider: event.provider,
          event_type: event.eventType,
          provider_message_id: event.providerMessageId,
          tracking_id: event.trackingId,
          event_timestamp: event.eventTimestamp,
          payload: event.payload,
          processing_status: 'processed',
        });

        const currentOpenCount = Number(matchedCampaignRecipient.open_count || 0);
        const currentClickCount = Number(matchedCampaignRecipient.click_count || 0);

        const patch: Record<string, unknown> = {
          status: matchedCampaignRecipient.status,
          last_event_at: nowIso,
        };

        if (mappedStatus === 'delivered') {
          patch.status = 'delivered';
          patch.delivered_at = nowIso;
        }
        if (mappedStatus === 'sent') {
          patch.status = 'sent';
          patch.sent_at = nowIso;
        }
        if (mappedStatus === 'opened') {
          patch.status = 'opened';
          patch.opened_at = nowIso;
          patch.first_opened_at = matchedCampaignRecipient.first_opened_at || nowIso;
          patch.open_count = currentOpenCount + 1;
        }
        if (mappedStatus === 'clicked') {
          patch.status = 'clicked';
          patch.clicked_at = nowIso;
          patch.click_count = currentClickCount + 1;
        }

        if (isBounceLike) {
          patch.status = 'bounced';
          patch.bounced_at = nowIso;
          patch.bounce_reason = `Provider webhook reported bounce (${event.eventType}).`;
          patch.error_message = `Provider webhook reported bounce (${event.eventType}).`;
        } else if (eventTypeLower.includes('unsubscribe')) {
          patch.status = 'unsubscribed';
          patch.unsubscribed_at = nowIso;
          patch.error_message = `Recipient unsubscribed (${event.eventType}).`;
        } else if (isFailureLike || mappedStatus === 'failed') {
          patch.status = 'failed';
          patch.error_message = `Provider webhook reported failure (${event.eventType}).`;
        }

        await admin
          .from('campaign_recipients')
          .update(patch)
          .eq('tenant_id', matchedCampaignRecipient.tenant_id)
          .eq('id', matchedCampaignRecipient.id);

        if (isBounceLike || eventTypeLower.includes('unsubscribe')) {
          await syncSuppressionCleanup({
            tenantId: matchedCampaignRecipient.tenant_id,
            email: String(matchedCampaignRecipient.email || '').trim(),
            reason: eventTypeLower.includes('unsubscribe') ? 'unsubscribe' : 'bounce',
            provider: event.provider,
            eventId: event.providerMessageId || event.trackingId || undefined,
            metadata: event.payload,
          });
        }

        processed += 1;
        affectedCampaigns.add(`${matchedCampaignRecipient.tenant_id}:${matchedCampaignRecipient.campaign_id}`);
        continue;
      }

      // 2) Backward compatible: legacy outreach reconciliation
      let lookup = admin
        .from('lead_outreach_log')
        .select('id, tenant_id, user_id, lead_email')
=======
    for (const event of parsedEvents) {
      let lookup = admin
        .from('lead_outreach_log')
        .select('id, tenant_id, user_id')
>>>>>>> origin/main
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

<<<<<<< HEAD
      await admin.from('email_webhook_events').insert({
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
=======
      const mappedStatus = mapDeliveryStatus(event.eventType);

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
>>>>>>> origin/main

      const patch: Record<string, unknown> = {
        provider_event_status: mappedStatus,
        provider_last_event_at: event.eventTimestamp || new Date().toISOString(),
      };
      if (mappedStatus === 'delivered' || mappedStatus === 'sent') patch.status = 'sent';
      if (mappedStatus === 'opened') patch.opened_at = event.eventTimestamp || new Date().toISOString();
      if (mappedStatus === 'clicked') patch.clicked_at = event.eventTimestamp || new Date().toISOString();
<<<<<<< HEAD
      if (isBounceLike) {
        patch.status = 'bounced';
        patch.provider_event_status = 'bounced';
        patch.error_message = `Provider webhook reported bounce (${event.eventType}).`;
      } else if (eventTypeLower.includes('unsubscribe')) {
        patch.status = 'unsubscribed';
        patch.provider_event_status = 'unsubscribed';
        patch.error_message = `Recipient unsubscribed (${event.eventType}).`;
      } else if (isFailureLike || mappedStatus === 'failed') {
=======
      if (mappedStatus === 'failed') {
>>>>>>> origin/main
        patch.status = 'failed';
        patch.error_message = `Provider webhook reported failure (${event.eventType}).`;
      }

<<<<<<< HEAD
      await admin.from('lead_outreach_log').update(patch).eq('tenant_id', logRow.tenant_id).eq('id', logRow.id);

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
=======
      await admin
        .from('lead_outreach_log')
        .update(patch)
        .eq('tenant_id', logRow.tenant_id)
        .eq('id', logRow.id);
>>>>>>> origin/main

      processed += 1;
    }

<<<<<<< HEAD
    // 3) Roll up affected email campaign totals from campaign_recipients truth
    for (const key of affectedCampaigns) {
      const [tenantId, campaignId] = key.split(':');
      const countByStatus = async (status: string): Promise<number> => {
        const { count } = await admin
          .from('campaign_recipients')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('campaign_id', campaignId)
          .eq('status', status);
        return count || 0;
      };

      const totalSent = await countByStatus('sent');
      const totalDelivered = await countByStatus('delivered');
      const totalOpened = await countByStatus('opened');
      const totalClicked = await countByStatus('clicked');
      const totalBounced = await countByStatus('bounced');
      const totalUnsubscribed = await countByStatus('unsubscribed');

      await admin
        .from('email_campaigns')
        .update({
          total_sent: totalSent,
          total_delivered: totalDelivered,
          total_opened: totalOpened,
          total_clicked: totalClicked,
          total_bounced: totalBounced,
          total_unsubscribed: totalUnsubscribed,
        })
        .eq('id', campaignId);
    }

=======
>>>>>>> origin/main
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
<<<<<<< HEAD
=======

>>>>>>> origin/main
