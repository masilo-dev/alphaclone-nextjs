import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { campaignHealth } from '@/lib/outreach/outreachIntelligence';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId') || '';
    if (!z.string().uuid().safeParse(tenantId).success) {
      return NextResponse.json({ error: 'Valid tenantId required' }, { status: 400 });
    }
    await requireTenantAccess(tenantId, request);
    const admin = createSupabaseAdminClient();

    const [
      campaignsResult,
      leadsResult,
      eventsResult,
      mailboxesResult,
      repliesResult,
      meetingsResult,
    ] = await Promise.allSettled([
      // Active campaigns
      admin
        .from('email_campaigns')
        .select('id, name, status, total_sent, total_bounced')
        .eq('tenant_id', tenantId)
        .in('status', ['sending', 'scheduled', 'active', 'queued'])
        .order('created_at', { ascending: false })
        .limit(10),

      // Ready leads (qualified but not yet contacted)
      admin
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('stage', ['qualified', 'ready_for_outreach']),

      // Outreach events (last 30 days)
      admin
        .from('outreach_events')
        .select('event_type')
        .eq('tenant_id', tenantId)
        .gte('occurred_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),

      // Mailbox warnings
      admin
        .from('outbound_mailboxes')
        .select('id, name, connection_state, sending_enabled, spf_status, dkim_status, dmarc_status, messages_sent_today, daily_limit')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null),

      // Pending positive replies
      admin
        .from('outreach_events')
        .select('id, lead_id, contact_id, metadata, occurred_at')
        .eq('tenant_id', tenantId)
        .eq('event_type', 'positive_reply')
        .gte('occurred_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('occurred_at', { ascending: false })
        .limit(20),

      // Meetings booked (last 30 days)
      admin
        .from('outreach_events')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('event_type', 'meeting_booked')
        .gte('occurred_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const events = eventsResult.status === 'fulfilled' ? eventsResult.value.data || [] : [];
    const countEvent = (type: string) => events.filter((e: { event_type: string }) => e.event_type === type).length;

    const mailboxes = mailboxesResult.status === 'fulfilled' ? mailboxesResult.value.data || [] : [];
    const mailboxWarnings = mailboxes.filter((m: {
      connection_state: string;
      sending_enabled: boolean;
      spf_status: string;
      dmarc_status: string;
      messages_sent_today: number;
      daily_limit: number;
    }) =>
      m.connection_state !== 'connected' ||
      !m.sending_enabled ||
      m.spf_status === 'critical' ||
      m.dmarc_status === 'critical' ||
      m.messages_sent_today >= m.daily_limit * 0.9
    );

    const activeCampaigns = campaignsResult.status === 'fulfilled'
      ? (campaignsResult.value.data || []).map((c: {
          id: string; name: string; status: string; total_sent: number; total_bounced: number;
        }) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          sent: c.total_sent || 0,
          bounceRate: c.total_sent > 0 ? c.total_bounced / c.total_sent : 0,
        }))
      : [];

    const health = campaignHealth({
      sent: countEvent('sent'),
      bounced: countEvent('bounced'),
      complained: countEvent('complained'),
      unsubscribed: countEvent('unsubscribed'),
    });

    return NextResponse.json({
      success: true,
      overview: {
        active_campaigns: activeCampaigns.length,
        active_campaigns_detail: activeCampaigns,
        ready_leads: leadsResult.status === 'fulfilled' ? leadsResult.value.count || 0 : 0,
        emails_sent_30d: countEvent('sent'),
        emails_delivered_30d: countEvent('delivered'),
        positive_replies_7d: repliesResult.status === 'fulfilled' ? (repliesResult.value.data || []).length : 0,
        positive_replies_detail: repliesResult.status === 'fulfilled' ? (repliesResult.value.data || []) : [],
        meetings_booked_30d: meetingsResult.status === 'fulfilled' ? meetingsResult.value.count || 0 : 0,
        bounce_rate_30d: health.bounceRate,
        reply_rate_30d: countEvent('sent') > 0
          ? (countEvent('replied') + countEvent('positive_reply')) / countEvent('sent')
          : 0,
        mailbox_warnings: mailboxWarnings.length,
        mailbox_warnings_detail: mailboxWarnings,
        system_health: health.safe ? 'healthy' : 'warning',
        health_reasons: health.reasons,
      },
    });
  } catch (error) {
    return routeErrorResponse(error, 'Outbound overview could not be loaded', request);
  }
}
