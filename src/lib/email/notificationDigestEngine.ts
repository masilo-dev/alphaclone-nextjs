import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { defaultDashboardUrl } from '@/lib/email/platformTemplateEmail';
import { escapeHtml } from '@/lib/email/escapeHtml';
import { renderAlphaCloneEmailLayout } from '@/lib/email/alphaCloneEmailLayouts';
import { aggregateDigestEvents } from '@/lib/email/notificationDigestAggregation';

export type DigestType = 'morning' | 'evening';

export interface BufferDigestEventInput {
  tenantId: string;
  userId: string;
  recipientEmail: string;
  eventType: string;
  eventCategory?: string;
  entityType?: string;
  entityId?: string;
  source?: string;
  sourceAction?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  summary: string;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
}

export async function bufferNotificationDigestEvent(input: BufferDigestEventInput) {
  const admin = createSupabaseAdminClient();
  return admin.from('notification_digest_events').insert({
    tenant_id: input.tenantId,
    user_id: input.userId,
    recipient_email: input.recipientEmail.trim().toLowerCase(),
    event_type: input.eventType,
    event_category: input.eventCategory || 'business',
    entity_type: input.entityType || null,
    entity_id: input.entityId || null,
    source: input.source || 'system',
    source_action: input.sourceAction || null,
    severity: input.severity || 'info',
    title: input.title,
    summary: input.summary,
    metadata: input.metadata || {},
    occurred_at: input.occurredAt || new Date().toISOString(),
  });
}

function localParts(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  return { date: `${value('year')}-${value('month')}-${value('day')}`, hour: Number(value('hour')) };
}

export function resolveDueDigest(now: Date, timeZone: string): { date: string; type: DigestType } | null {
  try {
    const local = localParts(now, timeZone);
    if (local.hour === 8) return { date: local.date, type: 'morning' };
    if (local.hour === 19) return { date: local.date, type: 'evening' };
    return null;
  } catch {
    const local = localParts(now, 'UTC');
    if (local.hour === 8) return { date: local.date, type: 'morning' };
    if (local.hour === 19) return { date: local.date, type: 'evening' };
    return null;
  }
}

export async function runNotificationDigests(options: { now?: Date; forceType?: DigestType } = {}) {
  const admin = createSupabaseAdminClient();
  const now = options.now || new Date();
  const { data: pending, error } = await admin.from('notification_digest_events')
    .select('id, tenant_id, user_id, recipient_email, event_type, event_category, entity_type, entity_id, source_action, severity, title, summary')
    .is('included_in_digest_id', null).order('occurred_at', { ascending: true }).limit(5000);
  if (error) throw new Error(`Unable to load digest events: ${error.message}`);

  const recipientGroups = new Map<string, any[]>();
  for (const event of pending || []) {
    const key = `${event.tenant_id}|${event.user_id}|${event.recipient_email}`;
    recipientGroups.set(key, [...(recipientGroups.get(key) || []), event]);
  }

  const report = { eventsBuffered: pending?.length || 0, eventsAggregated: 0, digestsSent: 0, duplicatesPrevented: 0, emailsAvoided: 0, failed: 0 };
  for (const events of recipientGroups.values()) {
    const first = events[0];
    const { data: tenant } = await admin.from('tenants').select('timezone').eq('id', first.tenant_id).maybeSingle();
    const timezone = tenant?.timezone || 'UTC';
    const due = options.forceType
      ? { date: localParts(now, timezone).date, type: options.forceType }
      : resolveDueDigest(now, timezone);
    if (!due) continue;

    const idempotencyKey = `${first.tenant_id}:${first.user_id}:${due.date}:${due.type}`;
    const { data: budgetAllowed } = await admin.rpc('check_internal_notification_budget', {
      p_tenant_id: first.tenant_id, p_user_id: first.user_id,
      p_recipient_email: first.recipient_email, p_digest_date: due.date,
    });
    if (budgetAllowed === false) continue;

    const { data: digest, error: claimError } = await admin.from('notification_digests').insert({
      tenant_id: first.tenant_id, user_id: first.user_id, recipient_email: first.recipient_email,
      digest_date: due.date, digest_type: due.type, timezone, status: 'sending',
      event_count: events.length, idempotency_key: idempotencyKey,
      metadata: { aggregation_version: 1 },
    }).select('id').single();
    if (claimError || !digest) {
      if (claimError?.code === '23505') report.duplicatesPrevented += 1;
      else report.failed += 1;
      continue;
    }

    const aggregated = aggregateDigestEvents(events);
    report.eventsAggregated += aggregated.length;
    report.emailsAvoided += Math.max(0, events.length - 1);
    const attention = aggregated.filter((item) => ['critical', 'error', 'warning'].includes(item.severity));
    const subject = due.type === 'morning'
      ? 'Good morning — your AlphaClone business brief'
      : `Your AlphaClone daily summary — ${due.date}`;
    const rows = aggregated.slice(0, 30).map((item) =>
      `<li>${item.severity === 'error' || item.severity === 'critical' ? '⚠' : '✓'} <strong>${item.count > 1 ? `${item.count} × ` : ''}${escapeHtml(item.title)}</strong>${item.count === 1 ? ` — ${escapeHtml(item.summary)}` : ''}</li>`
    ).join('');
    const dashboardUrl = defaultDashboardUrl();
    const rendered = renderAlphaCloneEmailLayout({
      layoutFamily: due.type === 'morning' ? 'morning_brief' : 'light',
      subject, headline: subject,
      bodyHtml: `<p>${events.length} events consolidated into ${aggregated.length} updates.</p>${attention.length ? `<h2>Needs your attention</h2><p>${attention.length} notable update(s)</p>` : ''}<h2>${due.type === 'morning' ? 'Overnight summary' : 'Executive summary'}</h2><ul>${rows}</ul>`,
      ctaLabel: 'View Activity', ctaUrl: dashboardUrl,
    });
    const sent = await sendEmailServer({
      tenantId: first.tenant_id, userId: first.user_id, to: first.recipient_email,
      subject, html: rendered.html, text: rendered.text, category: 'internal_notification',
      isPlatformNotification: true, templateName: `notification_digest_${due.type}`,
      idempotencyKey, internalNotificationKind: 'digest',
    });
    if (sent.success) {
      await admin.from('notification_digests').update({ status: 'sent', sent_at: new Date().toISOString(), provider_message_id: sent.emailId || null }).eq('id', digest.id);
      await admin.from('notification_digest_events').update({ included_in_digest_id: digest.id, processed_at: new Date().toISOString(), digest_period: due.type }).in('id', events.map((event) => event.id));
      report.digestsSent += 1;
    } else {
      await admin.from('notification_digests').update({ status: 'failed', metadata: { error: sent.error || 'provider_failed', aggregation_version: 1 } }).eq('id', digest.id);
      report.failed += 1;
    }
  }
  return report;
}
