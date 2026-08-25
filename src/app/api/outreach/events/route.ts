import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { campaignHealth, classifyOutreachReply } from '@/lib/outreach/outreachIntelligence';
import { normalizeOutreachRecipient } from '@/lib/revenue/connectedLifecycle';
import { emitTenantBusinessEvent } from '@/lib/notifications/emitTenantBusinessEvent';
import { recordBusinessActivity } from '@/lib/audit/businessAuditEngine';

const eventSchema = z.object({
  tenantId: z.uuid(), campaignId: z.uuid().optional(), sequenceId: z.uuid().optional(), stepId: z.uuid().optional(),
  contactId: z.uuid().optional(), leadId: z.uuid().optional(), dealId: z.uuid().optional(),
  channel: z.enum(['email','linkedin','sms','whatsapp','call','task']),
  eventType: z.enum(['queued','sent','delivered','opened','clicked','replied','positive_reply','objection','not_now','wrong_person','unsubscribed','bounced','complained','meeting_booked','deal_created','revenue']),
  provider: z.string().trim().max(80).optional(), providerEventId: z.string().trim().max(300).optional(),
  recipient: z.string().trim().max(320).optional(), replyText: z.string().max(100_000).optional(),
  variant: z.string().trim().max(80).optional(), metadata: z.record(z.string(), z.unknown()).default({}),
  revenue: z.object({ amount: z.number().nonnegative(), currencyCode: z.string().regex(/^[A-Z]{3}$/).default('USD'), contractId: z.uuid().optional(), invoiceId: z.uuid().optional(), projectId: z.uuid().optional() }).optional(),
  assignToUserId: z.uuid().optional(),
  createDeal: z.object({ name: z.string().trim().min(2).max(200), value: z.number().nonnegative().default(0), currencyCode: z.string().regex(/^[A-Z]{3}$/).default('USD') }).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const tenantId = String(request.nextUrl.searchParams.get('tenantId') || '');
    if (!z.string().uuid().safeParse(tenantId).success) return NextResponse.json({ error: 'Valid tenantId is required' }, { status: 400 });
    const { admin } = await requireTenantAccess(tenantId, request);
    const { data: events, error } = await admin.from('outreach_events')
      .select('campaign_id, event_type, occurred_at, metadata').eq('tenant_id', tenantId)
      .order('occurred_at', { ascending: false }).limit(5000);
    if (error) throw error;
    const grouped = new Map<string, Array<{ event_type: string }>>();
    for (const event of events || []) {
      const id = event.campaign_id || 'unassigned';
      grouped.set(id, [...(grouped.get(id) || []), event]);
    }
    const campaigns = [...grouped.entries()].map(([campaignId, rows]) => {
      const count = (type: string) => rows.filter((row) => row.event_type === type).length;
      const health = campaignHealth({ sent: count('sent'), bounced: count('bounced'), complained: count('complained'), unsubscribed: count('unsubscribed') });
      return { campaignId, events: rows.length, sent: count('sent'), delivered: count('delivered'), opened: count('opened'), clicked: count('clicked'), replies: count('replied') + count('positive_reply'), meetings: count('meeting_booked'), deals: count('deal_created'), revenueEvents: count('revenue'), ...health };
    });
    return NextResponse.json({ success: true, campaigns });
  } catch (error) {
    return routeErrorResponse(error, 'Outreach health could not be loaded', request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = eventSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid outreach event', details: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;
    const { admin } = await requireTenantAccess(input.tenantId, request);
    let eventType = input.eventType;
    const replyClassification = input.replyText ? classifyOutreachReply(input.replyText) : null;
    if (eventType === 'replied' && replyClassification && replyClassification !== 'neutral') {
      eventType = replyClassification === 'positive'
        ? 'positive_reply'
        : replyClassification === 'unsubscribe'
          ? 'unsubscribed'
          : replyClassification;
    }
    const { data: event, error } = await admin.from('outreach_events').insert({
      tenant_id: input.tenantId, campaign_id: input.campaignId || null, sequence_id: input.sequenceId || null,
      step_id: input.stepId || null, contact_id: input.contactId || null, lead_id: input.leadId || null,
      deal_id: input.dealId || null, channel: input.channel, event_type: eventType,
      provider: input.provider || null, provider_event_id: input.providerEventId || null,
      variant: input.variant || null, metadata: { ...input.metadata, reply_text: input.replyText || null, reply_classification: replyClassification },
    }).select('*').single();
    if (error) throw error;

    if (input.recipient && ['unsubscribed','complained','bounced'].includes(eventType)) {
      await admin.from('outreach_suppressions').upsert({
        tenant_id: input.tenantId, channel: input.channel,
        normalized_recipient: normalizeOutreachRecipient(input.channel, input.recipient),
        reason: eventType, source: input.provider || 'event',
      }, { onConflict: 'tenant_id,channel,normalized_recipient' });
    }

    let health = null;
    if (input.campaignId) {
      const { data: events } = await admin.from('outreach_events').select('event_type')
        .eq('tenant_id', input.tenantId).eq('campaign_id', input.campaignId);
      const counts = (events || []).reduce((acc: Record<string, number>, row: { event_type: string }) => {
        acc[row.event_type] = (acc[row.event_type] || 0) + 1;
        return acc;
      }, {});
      health = campaignHealth({ sent: counts.sent || 0, bounced: counts.bounced || 0, complained: counts.complained || 0, unsubscribed: counts.unsubscribed || 0 });
      if (health.shouldPause) {
        const { data: campaign } = await admin.from('email_campaigns').select('metadata')
          .eq('tenant_id', input.tenantId).eq('id', input.campaignId).maybeSingle();
        await admin.from('email_campaigns').update({ status: 'paused', metadata: { ...(campaign?.metadata || {}), auto_paused: true, health } })
          .eq('tenant_id', input.tenantId).eq('id', input.campaignId).in('status', ['running','sending','scheduled']);
      }
    }

    let createdDeal = null;
    if (eventType === 'positive_reply' && input.leadId) {
      await admin.from('leads').update({
        status: 'qualified',
        ...(input.assignToUserId ? { assigned_to: input.assignToUserId } : {}),
        updated_at: new Date().toISOString(),
      }).eq('tenant_id', input.tenantId).eq('id', input.leadId);
      if (input.createDeal) {
        const { data: deal, error: dealError } = await admin.from('deals').insert({
          tenant_id: input.tenantId, name: input.createDeal.name,
          value: input.createDeal.value, currency: input.createDeal.currencyCode,
          stage: 'qualification', owner_id: input.assignToUserId || null,
          source: 'outreach', metadata: { lead_id: input.leadId, outreach_event_id: event.id },
        }).select('*').single();
        if (dealError) throw dealError;
        createdDeal = deal;
        await admin.from('revenue_lifecycle_links').insert({
          tenant_id: input.tenantId, source_type: 'lead', source_id: input.leadId,
          target_type: 'deal', target_id: deal.id, relationship: 'converted_to',
          metadata: { outreach_event_id: event.id },
        });
      }
    }

    if (input.revenue) {
      const { error: attributionError } = await admin.from('revenue_attribution').insert({
        tenant_id: input.tenantId, campaign_id: input.campaignId || null, outreach_event_id: event.id,
        contact_id: input.contactId || null, lead_id: input.leadId || null, deal_id: input.dealId || null,
        contract_id: input.revenue.contractId || null, invoice_id: input.revenue.invoiceId || null,
        project_id: input.revenue.projectId || null, attributed_amount: input.revenue.amount,
        currency_code: input.revenue.currencyCode, evidence: { source_event: eventType },
      });
      if (attributionError) throw attributionError;
    }

    const isReplyEvent = ['replied', 'positive_reply', 'objection', 'not_now'].includes(eventType);
    if (isReplyEvent && input.leadId) {
      const { data: latestLog } = await admin
        .from('lead_outreach_log')
        .select('id')
        .eq('tenant_id', input.tenantId)
        .eq('lead_id', input.leadId)
        .in('status', ['sent', 'delivered', 'opened', 'clicked'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestLog?.id) {
        await admin
          .from('lead_outreach_log')
          .update({ status: 'replied', provider_event_status: 'replied' })
          .eq('tenant_id', input.tenantId)
          .eq('id', latestLog.id);
      }

      const { data: owner } = await admin
        .from('tenant_users')
        .select('user_id')
        .eq('tenant_id', input.tenantId)
        .in('role', ['owner', 'admin'])
        .limit(1)
        .maybeSingle();

      await recordBusinessActivity({
        tenantId: input.tenantId,
        event: 'Lead replied to outreach',
        actor: 'Prospect',
        businessContext: input.replyText?.slice(0, 200) || 'Reply received via outreach channel',
        relatedRecordType: 'lead',
        relatedRecordId: input.leadId,
        result: 'Reply logged — follow up required',
        status: 'waiting',
        technicalDetails: { source: 'outreach_events', event_id: event.id, campaign_id: input.campaignId },
      }).catch(() => undefined);

      await emitTenantBusinessEvent({
        tenantId: input.tenantId,
        userId: owner?.user_id,
        eventType: 'lead.replied',
        source: 'system',
        title: `Prospect replied${input.recipient ? ` — ${input.recipient}` : ''}`,
        message: input.replyText?.slice(0, 160) || 'A prospect replied to your outreach.',
        actionUrl: '/dashboard/crm/leads',
        entityType: 'lead',
        entityId: input.leadId,
        status: 'waiting',
        metadata: { campaign_id: input.campaignId, reply_classification: replyClassification },
      }).catch(() => undefined);
    }

    return NextResponse.json({ success: true, event, replyClassification, health, createdDeal }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Outreach event could not be recorded', request);
  }
}
