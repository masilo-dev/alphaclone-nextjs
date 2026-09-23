/**
 * Outbound Mailbox Service
 * Unified mailbox model — wraps provider configs with health + limit tracking.
 * Credentials stay in existing provider integrations; this layer adds
 * operational metadata for outbound sending decisions.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { resolveMx, resolveTxt } from 'dns/promises';

export type MailboxProvider = 'microsoft' | 'zoho' | 'brevo' | 'resend' | 'sendgrid' | 'smtp' | 'other';
export type ConnectionState = 'connected' | 'disconnected' | 'error' | 'unchecked';
export type DnsCheckStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

export interface OutboundMailbox {
  id: string;
  tenant_id: string;
  name: string;
  provider: MailboxProvider;
  email_address: string;
  from_name?: string;
  reply_to?: string;
  domain?: string;
  is_primary_domain: boolean;
  connection_state: ConnectionState;
  sending_enabled: boolean;
  last_connection_check?: string;
  last_connection_error?: string;
  daily_limit: number;
  hourly_limit?: number;
  messages_sent_today: number;
  sent_today_reset_at?: string;
  bounce_count_7d: number;
  complaint_count_7d: number;
  last_successful_send?: string;
  last_error?: string;
  last_error_at?: string;
  spf_status: DnsCheckStatus;
  dkim_status: DnsCheckStatus;
  dmarc_status: DnsCheckStatus;
  mx_status: DnsCheckStatus;
  dns_checked_at?: string;
  dns_remediation: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface MailboxHealth {
  mailbox_id: string;
  can_send: boolean;
  remaining_today: number;
  warnings: string[];
  errors: string[];
  overall_status: 'healthy' | 'degraded' | 'blocked';
}

export async function listMailboxes(tenantId: string): Promise<OutboundMailbox[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('outbound_mailboxes')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as OutboundMailbox[];
}

export async function getMailbox(tenantId: string, mailboxId: string): Promise<OutboundMailbox | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('outbound_mailboxes')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', mailboxId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data as OutboundMailbox | null;
}

export async function createMailbox(
  tenantId: string,
  userId: string,
  input: {
    name: string;
    provider: MailboxProvider;
    email_address: string;
    from_name?: string;
    reply_to?: string;
    is_primary_domain?: boolean;
    daily_limit?: number;
    hourly_limit?: number;
  }
): Promise<OutboundMailbox> {
  const admin = createSupabaseAdminClient();
  const domain = input.email_address.split('@')[1] || null;
  const { data, error } = await admin
    .from('outbound_mailboxes')
    .insert({
      tenant_id: tenantId,
      created_by: userId,
      name: input.name,
      provider: input.provider,
      email_address: input.email_address.toLowerCase().trim(),
      from_name: input.from_name || null,
      reply_to: input.reply_to || null,
      domain,
      is_primary_domain: input.is_primary_domain ?? false,
      daily_limit: input.daily_limit ?? 100,
      hourly_limit: input.hourly_limit ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as OutboundMailbox;
}

export async function updateMailbox(
  tenantId: string,
  mailboxId: string,
  updates: Partial<Pick<
    OutboundMailbox,
    | 'name' | 'from_name' | 'reply_to' | 'is_primary_domain'
    | 'sending_enabled' | 'daily_limit' | 'hourly_limit'
    | 'connection_state' | 'last_connection_error' | 'last_connection_check'
    | 'last_error' | 'last_error_at' | 'last_successful_send'
  >>
): Promise<OutboundMailbox> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('outbound_mailboxes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', mailboxId)
    .select('*')
    .single();
  if (error) throw error;
  return data as OutboundMailbox;
}

/**
 * Check if a mailbox can send right now.
 * Resets daily counter if it's a new day.
 */
export async function checkMailboxHealth(
  tenantId: string,
  mailboxId: string
): Promise<MailboxHealth> {
  const mailbox = await getMailbox(tenantId, mailboxId);
  if (!mailbox) {
    return {
      mailbox_id: mailboxId,
      can_send: false,
      remaining_today: 0,
      warnings: [],
      errors: ['MAILBOX_NOT_FOUND'],
      overall_status: 'blocked',
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // Reset daily counter if needed
  const today = new Date().toISOString().slice(0, 10);
  let sentToday = mailbox.messages_sent_today;
  if (mailbox.sent_today_reset_at !== today) {
    sentToday = 0;
    await createSupabaseAdminClient()
      .from('outbound_mailboxes')
      .update({
        messages_sent_today: 0,
        sent_today_reset_at: today,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', mailboxId);
  }

  if (!mailbox.sending_enabled) {
    errors.push('MAILBOX_SEND_DISABLED');
  }
  if (mailbox.connection_state === 'error') {
    errors.push('MAILBOX_NOT_CONNECTED');
  }
  if (mailbox.connection_state === 'disconnected') {
    errors.push('MAILBOX_NOT_CONNECTED');
  }

  const remaining = mailbox.daily_limit - sentToday;
  if (remaining <= 0) {
    errors.push('MAILBOX_LIMIT_REACHED');
  } else if (remaining < mailbox.daily_limit * 0.1) {
    warnings.push(`Only ${remaining} sends remaining today`);
  }

  if (mailbox.is_primary_domain) {
    warnings.push('PRIMARY_DOMAIN_WARNING: This is your primary business domain. Cold outreach may affect domain reputation.');
  }

  if (mailbox.bounce_count_7d > 10) {
    warnings.push(`High bounce count: ${mailbox.bounce_count_7d} in last 7 days`);
  }

  const dns_issues = [mailbox.spf_status, mailbox.dkim_status, mailbox.dmarc_status].filter(
    (s) => s === 'critical'
  );
  if (dns_issues.length > 0) {
    warnings.push(`DNS issues detected: ${dns_issues.length} critical checks`);
  }

  return {
    mailbox_id: mailboxId,
    can_send: errors.length === 0,
    remaining_today: Math.max(0, remaining),
    warnings,
    errors,
    overall_status: errors.length > 0 ? 'blocked' : warnings.length > 0 ? 'degraded' : 'healthy',
  };
}

/**
 * Increment sent counter after a successful send.
 */
export async function recordMailboxSend(tenantId: string, mailboxId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  try {
    await admin.rpc('increment_mailbox_sent_today', {
      p_tenant_id: tenantId,
      p_mailbox_id: mailboxId,
      p_today: today,
    });
  } catch {
    // Fallback if RPC not available
    const { data } = await admin
      .from('outbound_mailboxes')
      .select('messages_sent_today, sent_today_reset_at')
      .eq('tenant_id', tenantId)
      .eq('id', mailboxId)
      .single();
    if (data) {
      const currentCount = data.sent_today_reset_at === today ? (data.messages_sent_today || 0) : 0;
      await admin
        .from('outbound_mailboxes')
        .update({
          messages_sent_today: currentCount + 1,
          sent_today_reset_at: today,
          last_successful_send: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('id', mailboxId);
    }
  }
}

/**
 * Check DNS health for a mailbox domain.
 * Uses Node dns module — no external API required.
 */
export async function checkDomainHealth(
  tenantId: string,
  mailboxId: string,
  domain: string
): Promise<{
  spf: DnsCheckStatus;
  dkim: DnsCheckStatus;
  dmarc: DnsCheckStatus;
  mx: DnsCheckStatus;
  remediation: Record<string, string>;
}> {
  const remediation: Record<string, string> = {};
  const results = await Promise.allSettled([
    checkSPF(domain),
    checkDMARC(domain),
    checkMX(domain),
  ]);

  const [spfResult, dmarcResult, mxResult] = results;

  const spf: DnsCheckStatus = spfResult.status === 'fulfilled'
    ? spfResult.value.status
    : 'unknown';
  if (spf !== 'healthy') {
    remediation.spf = 'Add a TXT record: v=spf1 include:your-provider.com ~all';
  }

  const dmarc: DnsCheckStatus = dmarcResult.status === 'fulfilled'
    ? dmarcResult.value.status
    : 'unknown';
  if (dmarc !== 'healthy') {
    remediation.dmarc = 'Add a TXT record at _dmarc.' + domain + ': v=DMARC1; p=quarantine; rua=mailto:dmarc@' + domain;
  }

  const mx: DnsCheckStatus = mxResult.status === 'fulfilled'
    ? mxResult.value.status
    : 'unknown';
  if (mx !== 'healthy') {
    remediation.mx = 'Ensure MX records are configured for your domain in your DNS provider.';
  }

  // DKIM requires selector knowledge — mark as unknown (can't verify without selector)
  const dkim: DnsCheckStatus = 'unknown';
  remediation.dkim = 'Verify your email provider has added DKIM records. Check your sending provider dashboard.';

  // Persist results
  const admin = createSupabaseAdminClient();
  await admin
    .from('outbound_mailboxes')
    .update({
      spf_status: spf,
      dkim_status: dkim,
      dmarc_status: dmarc,
      mx_status: mx,
      dns_checked_at: new Date().toISOString(),
      dns_remediation: remediation,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', mailboxId);

  return { spf, dkim, dmarc, mx, remediation };
}

async function checkSPF(domain: string): Promise<{ status: DnsCheckStatus }> {
  try {
    const records = await resolveTxt(domain);
    const spfRecord = records.flat().find((r) => r.startsWith('v=spf1'));
    return { status: spfRecord ? 'healthy' : 'critical' };
  } catch {
    return { status: 'unknown' };
  }
}

async function checkDMARC(domain: string): Promise<{ status: DnsCheckStatus }> {
  try {
    const records = await resolveTxt(`_dmarc.${domain}`);
    const dmarcRecord = records.flat().find((r) => r.startsWith('v=DMARC1'));
    if (!dmarcRecord) return { status: 'critical' };
    // Check policy strength
    if (dmarcRecord.includes('p=reject')) return { status: 'healthy' };
    if (dmarcRecord.includes('p=quarantine')) return { status: 'healthy' };
    if (dmarcRecord.includes('p=none')) return { status: 'warning' };
    return { status: 'healthy' };
  } catch {
    return { status: 'critical' };
  }
}

async function checkMX(domain: string): Promise<{ status: DnsCheckStatus }> {
  try {
    const records = await resolveMx(domain);
    return { status: records.length > 0 ? 'healthy' : 'critical' };
  } catch {
    return { status: 'critical' };
  }
}
