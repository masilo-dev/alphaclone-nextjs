import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  DELIVERY_PROVIDER_LABELS,
  resolveAutoProvider,
  type DeliveryEmailProvider,
} from '@/lib/email/emailProviderOptions';

export const dynamic = 'force-dynamic';

const CACHE_HEADERS = {
  'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
};

type CampaignRow = {
  id: string;
  name: string;
  status: string;
  subject?: string | null;
  total_recipients?: number | null;
  recipient_count?: number | null;
  total_sent?: number | null;
  sent_count?: number | null;
  total_failed?: number | null;
  failed_count?: number | null;
  bounced_count?: number | null;
  total_opened?: number | null;
  opened_count?: number | null;
  total_clicked?: number | null;
  clicked_count?: number | null;
  replied_count?: number | null;
  reply_count?: number | null;
  scheduled_at?: string | null;
  started_at?: string | null;
  next_batch_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string | null;
};

type OutreachRow = {
  id: string;
  lead_email?: string | null;
  lead_name?: string | null;
  business_name?: string | null;
  status?: string | null;
  created_at: string;
  updated_at?: string | null;
  campaign_name?: string | null;
  provider?: string | null;
  error_message?: string | null;
};

type AttentionItem = {
  id: string;
  type: 'bounce' | 'provider' | 'outreach_failed' | 'social_failed' | 'campaign_failed' | 'reconnect';
  title: string;
  detail: string;
  affected?: number;
  href?: string;
  action?: string;
};

type ActivityItem = {
  id: string;
  time: string;
  label: string;
  source?: string;
  detail?: string;
};

function todayStartIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    const { user } = await requireTenantAccess(tenantId, request);
    const userId = user.id;
    const admin = createSupabaseAdminClient();
    const todayStart = todayStartIso();

    const [
      campaignsRes,
      outreachTodayRes,
      outreachFailedRes,
      outreachRecentRes,
      socialScheduledRes,
      socialFailedRes,
      socialTodayRes,
      repliesTodayRes,
      meetingsTodayRes,
      qualifiedRes,
      customersRes,
      bouncesRes,
      suppressionsRes,
      integrationsRes,
      msConnRes,
      settingsRes,
      auditRes,
      mcpRes,
    ] = await Promise.all([
      admin
        .from('email_campaigns')
        .select(
          'id, name, status, subject, total_recipients, recipient_count, total_sent, sent_count, total_failed, failed_count, bounced_count, total_opened, opened_count, total_clicked, clicked_count, replied_count, reply_count, scheduled_at, started_at, next_batch_at, metadata, created_at, updated_at',
        )
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false })
        .limit(50),
      admin
        .from('lead_outreach_log')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', todayStart)
        .in('status', ['sent', 'delivered']),
      admin
        .from('lead_outreach_log')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', todayStart)
        .eq('status', 'failed'),
      admin
        .from('lead_outreach_log')
        .select('id, lead_email, lead_name, business_name, status, created_at, updated_at, campaign_name, provider, error_message')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(20),
      admin
        .from('social_posts')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('status', ['scheduled', 'queued']),
      admin
        .from('social_posts')
        .select('id, caption, status, error_message, platforms')
        .eq('tenant_id', tenantId)
        .eq('status', 'failed')
        .order('updated_at', { ascending: false })
        .limit(5),
      admin
        .from('social_posts')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', todayStart)
        .eq('status', 'published'),
      admin
        .from('lead_outreach_log')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', todayStart)
        .eq('status', 'replied'),
      admin
        .from('calendar_events')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('start_time', todayStart.slice(0, 10)),
      admin
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('stage', ['qualified', 'mql', 'sql']),
      admin
        .from('business_clients')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('sales_stage', ['customer', 'won']),
      admin
        .from('campaign_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'bounced')
        .gte('bounced_at', todayStart),
      admin
        .from('email_suppressions')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      admin
        .from('integrations')
        .select('type, enabled, config')
        .or(`user_id.eq.${userId},tenant_id.eq.${tenantId}`)
        .in('type', ['brevo', 'resend', 'sendgrid', 'zoho', 'gmail', 'linkedin', 'facebook']),
      admin
        .from('microsoft_connections')
        .select('microsoft_email')
        .or(`user_id.eq.${userId},tenant_id.eq.${tenantId}`)
        .maybeSingle(),
      admin
        .from('business_settings')
        .select('settings')
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      admin
        .from('audit_logs')
        .select('id, action, entity_type, created_at, metadata')
        .eq('tenant_id', tenantId)
        .in('entity_type', ['campaign', 'email', 'social', 'outreach'])
        .order('created_at', { ascending: false })
        .limit(10),
      admin
        .from('mcp_sessions')
        .select('id, tool_name, success, created_at, metadata')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const campaigns = (campaignsRes.data || []) as CampaignRow[];
    const activeCampaigns = campaigns.filter((c) =>
      ['active', 'sending', 'processing', 'queued', 'scheduled'].includes(String(c.status).toLowerCase()),
    );

    const emailsSentToday =
      campaigns
        .filter((c) => c.started_at && c.started_at >= todayStart)
        .reduce((s, c) => s + Number(c.total_sent ?? c.sent_count ?? 0), 0) +
      (outreachTodayRes.count || 0);

    const attention: AttentionItem[] = [];

    const bounceCount = bouncesRes.count || 0;
    if (bounceCount > 0) {
      attention.push({
        id: 'bounces',
        type: 'bounce',
        title: `${bounceCount} bounced email${bounceCount === 1 ? '' : 's'}`,
        detail: 'Review bounced recipients before continuing sends',
        affected: bounceCount,
        href: '/dashboard/marketing/deliverability',
        action: 'View recipients',
      });
    }

    const outreachFailed = outreachFailedRes.count || 0;
    if (outreachFailed > 0) {
      attention.push({
        id: 'outreach-failed',
        type: 'outreach_failed',
        title: `${outreachFailed} outreach message${outreachFailed === 1 ? '' : 's'} failed`,
        detail: 'Review failed sends and retry where safe',
        affected: outreachFailed,
        href: '/dashboard/marketing/outreach',
        action: 'Review',
      });
    }

    for (const post of socialFailedRes.data || []) {
      const platforms = Array.isArray(post.platforms) ? post.platforms.join(', ') : 'Social';
      attention.push({
        id: `social-${post.id}`,
        type: 'social_failed',
        title: 'Failed social post',
        detail: post.error_message || platforms,
        href: '/dashboard/business/social-command',
        action: 'Retry',
      });
    }

    for (const campaign of activeCampaigns.filter((c) => {
      const failed = Number(c.total_failed ?? c.failed_count ?? c.bounced_count ?? 0);
      return failed > 0;
    })) {
      const failed = Number(campaign.total_failed ?? campaign.failed_count ?? campaign.bounced_count ?? 0);
      attention.push({
        id: `campaign-fail-${campaign.id}`,
        type: 'campaign_failed',
        title: `${campaign.name}: ${failed} failed`,
        detail: 'Some recipients did not receive the message',
        affected: failed,
        href: `/dashboard/business/campaigns?campaign=${campaign.id}`,
        action: 'View failed',
      });
    }

    const settings = (settingsRes.data?.settings || {}) as Record<string, unknown>;
    const emailSettings = (settings.email || {}) as Record<string, unknown>;
    const defaultProvider = String(emailSettings.default_provider || 'auto');

    const connectedProviders: DeliveryEmailProvider[] = [];
    const providerHealth: Array<{
      id: DeliveryEmailProvider;
      label: string;
      connected: boolean;
      role: 'primary' | 'backup' | 'mailbox';
      health: 'healthy' | 'rate_limited' | 'needs_reconnect' | 'config_issue' | 'unavailable';
    }> = [];

    const integrationMap = new Map<string, { enabled: boolean; config: Record<string, unknown> }>();
    for (const row of integrationsRes.data || []) {
      integrationMap.set(row.type, { enabled: Boolean(row.enabled), config: (row.config || {}) as Record<string, unknown> });
    }

    const checkConnected = (type: string): boolean => {
      const row = integrationMap.get(type);
      if (!row?.enabled) return false;
      const cfg = row.config;
      return Boolean(cfg.apiKey || cfg.api_key || cfg.access_token || cfg.refreshToken || cfg.refresh_token);
    };

    if (checkConnected('zoho')) connectedProviders.push('zoho');
    if (msConnRes.data?.microsoft_email) connectedProviders.push('microsoft');
    if (checkConnected('brevo')) connectedProviders.push('brevo');
    if (checkConnected('resend')) connectedProviders.push('resend');
    if (checkConnected('sendgrid')) connectedProviders.push('sendgrid');
    if (checkConnected('gmail')) connectedProviders.push('gmail');

    const resolvedPrimary = resolveAutoProvider(connectedProviders, defaultProvider);

    for (const id of ['brevo', 'resend', 'sendgrid', 'zoho', 'gmail'] as DeliveryEmailProvider[]) {
      const connected = id === 'zoho' ? checkConnected('zoho') : checkConnected(id);
      if (!connected && id !== resolvedPrimary) continue;
      providerHealth.push({
        id,
        label: DELIVERY_PROVIDER_LABELS[id],
        connected,
        role: id === resolvedPrimary ? 'primary' : connected ? 'backup' : 'backup',
        health: connected ? 'healthy' : 'needs_reconnect',
      });
    }

    if (msConnRes.data?.microsoft_email) {
      providerHealth.push({
        id: 'microsoft',
        label: DELIVERY_PROVIDER_LABELS.microsoft,
        connected: true,
        role: resolvedPrimary === 'microsoft' ? 'primary' : 'mailbox',
        health: 'healthy',
      });
    }

    for (const row of integrationsRes.data || []) {
      if (!row.enabled && ['linkedin', 'facebook'].includes(row.type)) {
        attention.push({
          id: `reconnect-${row.type}`,
          type: 'reconnect',
          title: `${row.type === 'linkedin' ? 'LinkedIn' : 'Facebook'} token needs reconnect`,
          detail: 'Social publishing will fail until reconnected',
          href: '/dashboard/marketplace',
          action: 'Reconnect',
        });
      }
    }

    const recentOutreach = ((outreachRecentRes.data || []) as OutreachRow[]).slice(0, 10).map((row) => ({
      id: row.id,
      company: row.business_name || row.lead_name || 'Unknown',
      recipient: row.lead_email || '',
      status: row.status || 'unknown',
      lastAction: formatTime(row.updated_at || row.created_at),
      nextStep:
        row.status === 'replied'
          ? 'Review reply'
          : row.status === 'failed'
            ? 'Retry'
            : row.status === 'sent' || row.status === 'delivered'
              ? 'Follow-up tomorrow'
              : 'Waiting',
      error: row.error_message || undefined,
    }));

    const activity: ActivityItem[] = [];

    for (const row of auditRes.data || []) {
      activity.push({
        id: `audit-${row.id}`,
        time: formatTime(row.created_at),
        label: String(row.action || row.entity_type),
        source: 'AlphaClone',
        detail: (row.metadata as Record<string, unknown>)?.name as string | undefined,
      });
    }

    for (const row of mcpRes.data || []) {
      const tool = String(row.tool_name || '');
      if (!tool.includes('email') && !tool.includes('outreach') && !tool.includes('campaign') && !tool.includes('social')) {
        continue;
      }
      activity.push({
        id: `mcp-${row.id}`,
        time: formatTime(row.created_at),
        label: tool.replace(/_/g, ' '),
        source: 'ChatGPT',
        detail: row.success ? 'Completed' : 'Failed',
      });
    }

    activity.sort((a, b) => {
      const parse = (t: string) => {
        if (t.endsWith('m ago')) return Number(t.replace('m ago', ''));
        if (t.endsWith('h ago')) return Number(t.replace('h ago', '')) * 60;
        if (t.endsWith('d ago')) return Number(t.replace('d ago', '')) * 1440;
        return 9999;
      };
      return parse(a.time) - parse(b.time);
    });

    const activeWork = activeCampaigns.slice(0, 6).map((c) => {
      const total = Number(c.total_recipients ?? c.recipient_count ?? 0);
      const sent = Number(c.total_sent ?? c.sent_count ?? 0);
      const failed = Number(c.total_failed ?? c.failed_count ?? c.bounced_count ?? 0);
      const replied = Number(c.replied_count ?? c.reply_count ?? 0);
      const progress = total > 0 ? Math.round((sent / total) * 100) : 0;
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        total,
        processed: sent + failed,
        sent,
        failed,
        replied,
        progress,
        scheduledAt: c.scheduled_at,
        nextBatchAt: c.next_batch_at,
      };
    });

    return NextResponse.json(
      {
        today: {
          emailsSent: emailsSentToday,
          outreachSent: outreachTodayRes.count || 0,
          socialPosts: socialTodayRes.count || 0,
          replies: repliesTodayRes.count || 0,
          meetingsBooked: meetingsTodayRes.count || 0,
        },
        activeWork,
        socialScheduled: socialScheduledRes.count || 0,
        needsAttention: attention.slice(0, 8),
        recentResults: {
          replies: repliesTodayRes.count || 0,
          meetings: meetingsTodayRes.count || 0,
          qualifiedLeads: qualifiedRes.count || 0,
          customers: customersRes.count || 0,
        },
        delivery: {
          mode: 'automatic',
          resolvedProvider: resolvedPrimary,
          resolvedLabel: DELIVERY_PROVIDER_LABELS[resolvedPrimary] || resolvedPrimary,
          providers: providerHealth,
        },
        recentOutreach,
        activity: activity.slice(0, 12),
        deliverability: {
          suppressed: suppressionsRes.count || 0,
        },
        globalPauseAvailable: false,
      },
      { headers: CACHE_HEADERS },
    );
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load marketing overview', request);
  }
}
