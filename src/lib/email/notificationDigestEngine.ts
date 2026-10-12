import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { defaultDashboardUrl } from '@/lib/email/platformTemplateEmail';
import { renderAlphaCloneEmailLayout } from '@/lib/email/alphaCloneEmailLayouts';
import { aggregateDigestEvents } from '@/lib/email/notificationDigestAggregation';
import {
  composeSummaryBody,
  groupChaseItemsForSummary,
  localDateHour,
  normalizeSummaryPreferences,
  resolveDueSummary,
  type ChaseSummaryRow,
  type DigestType,
  type SummaryPreferences,
} from '@/lib/email/dailySummaryComposer';

export type { DigestType } from '@/lib/email/dailySummaryComposer';

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

export function resolveDueDigest(
  now: Date,
  timeZone: string,
  prefs?: SummaryPreferences,
): { date: string; type: DigestType } | null {
  return resolveDueSummary(now, timeZone, prefs || normalizeSummaryPreferences(null));
}

type DigestEventRow = {
  id: string; tenant_id: string; user_id: string; recipient_email: string; event_type: string;
  event_category: string; entity_type: string | null; entity_id: string | null; source_action: string | null;
  severity: string; title: string; summary: string;
};

type RecipientGroup = { tenantId: string; userId: string; email: string; events: DigestEventRow[] };

async function loadStalledWork(admin: ReturnType<typeof createSupabaseAdminClient>, tenantId: string): Promise<ChaseSummaryRow[]> {
  const { data, error } = await admin
    .from('chase_instances')
    .select('policy_key, severity, reason_code, context_snapshot')
    .eq('tenant_id', tenantId)
    .not('state', 'in', '("RESOLVED","EXHAUSTED","CANCELLED")')
    .order('severity', { ascending: false })
    .limit(200);
  if (error) {
    console.warn('[notification-digest] stalled work unavailable:', error.message);
    return [];
  }
  return (data || []) as ChaseSummaryRow[];
}

export async function runNotificationDigests(options: { now?: Date; forceType?: DigestType } = {}) {
  const admin = createSupabaseAdminClient();
  const now = options.now || new Date();
  const { data: pending, error } = await admin.from('notification_digest_events')
    .select('id, tenant_id, user_id, recipient_email, event_type, event_category, entity_type, entity_id, source_action, severity, title, summary')
    .is('included_in_digest_id', null).order('occurred_at', { ascending: true }).limit(5000);
  if (error) throw new Error(`Unable to load digest events: ${error.message}`);

  const recipientGroups = new Map<string, RecipientGroup>();
  for (const event of (pending || []) as DigestEventRow[]) {
    const email = String(event.recipient_email || '').trim().toLowerCase();
    const key = `${event.tenant_id}|${event.user_id}|${email}`;
    const group = recipientGroups.get(key) || { tenantId: event.tenant_id, userId: event.user_id, email, events: [] };
    group.events.push(event);
    recipientGroups.set(key, group);
  }

  // Every tenant owner receives the consolidated summary, even on a quiet day.
  const { data: tenants } = await admin.from('tenants').select('id, owner_id, timezone').not('owner_id', 'is', null).limit(1000);
  const tenantById = new Map<string, { owner_id: string | null; timezone: string | null }>();
  for (const t of tenants || []) tenantById.set(t.id, { owner_id: t.owner_id, timezone: t.timezone });
  const ownerIds = [...new Set((tenants || []).map((t) => t.owner_id).filter(Boolean))] as string[];
  const profileById = new Map<string, { email: string | null; email_preferences: Record<string, unknown> | null }>();
  for (let i = 0; i < ownerIds.length; i += 200) {
    const { data: profiles } = await admin.from('profiles').select('id, email, email_preferences').in('id', ownerIds.slice(i, i + 200));
    for (const p of profiles || []) profileById.set(p.id, { email: p.email, email_preferences: p.email_preferences });
  }
  for (const t of tenants || []) {
    const email = String(profileById.get(t.owner_id as string)?.email || '').trim().toLowerCase();
    if (!email) continue;
    const key = `${t.id}|${t.owner_id}|${email}`;
    if (!recipientGroups.has(key)) recipientGroups.set(key, { tenantId: t.id, userId: t.owner_id as string, email, events: [] });
  }

  const report = {
    eventsBuffered: pending?.length || 0, eventsAggregated: 0, digestsSent: 0, duplicatesPrevented: 0,
    emailsAvoided: 0, failed: 0, notDue: 0, optedOut: 0, quietSummaries: 0, stalledItemsIncluded: 0,
  };

  for (const group of recipientGroups.values()) {
    const events = group.events;
    let tenant = tenantById.get(group.tenantId);
    if (!tenant) {
      const { data } = await admin.from('tenants').select('owner_id, timezone').eq('id', group.tenantId).maybeSingle();
      tenant = { owner_id: data?.owner_id || null, timezone: data?.timezone || null };
      tenantById.set(group.tenantId, tenant);
    }
    const timezone = tenant.timezone || 'UTC';
    let profile = profileById.get(group.userId);
    if (!profile) {
      const { data } = await admin.from('profiles').select('email, email_preferences').eq('id', group.userId).maybeSingle();
      profile = { email: data?.email || null, email_preferences: data?.email_preferences || null };
      profileById.set(group.userId, profile);
    }
    const prefs = normalizeSummaryPreferences(profile.email_preferences);
    if (!prefs.enabled) { report.optedOut += 1; continue; }
    const due = options.forceType
      ? { date: localDateHour(now, timezone).date, type: options.forceType }
      : resolveDueDigest(now, timezone, prefs);
    if (!due) { report.notDue += 1; continue; }

    const idempotencyKey = `${group.tenantId}:${group.userId}:${due.date}:${due.type}`;
    const { data: budgetAllowed } = await admin.rpc('check_internal_notification_budget', {
      p_tenant_id: group.tenantId, p_user_id: group.userId,
      p_recipient_email: group.email, p_digest_date: due.date,
    });
    if (budgetAllowed === false) { report.duplicatesPrevented += 1; continue; }

    const isOwner = tenant.owner_id === group.userId;
    const stalledRows = isOwner ? await loadStalledWork(admin, group.tenantId) : [];
    const chaseSections = groupChaseItemsForSummary(stalledRows);

    const { data: digest, error: claimError } = await admin.from('notification_digests').insert({
      tenant_id: group.tenantId, user_id: group.userId, recipient_email: group.email,
      digest_date: due.date, digest_type: due.type, timezone, status: 'sending',
      event_count: events.length, idempotency_key: idempotencyKey,
      metadata: { aggregation_version: 2, schedule: prefs.schedule, stalled_items: stalledRows.length },
    }).select('id').single();
    if (claimError || !digest) {
      if (claimError?.code === '23505') report.duplicatesPrevented += 1;
      else report.failed += 1;
      continue;
    }

    const aggregated = aggregateDigestEvents(events);
    report.eventsAggregated += aggregated.length;
    report.emailsAvoided += Math.max(0, events.length - 1);
    report.stalledItemsIncluded += stalledRows.length;
    const composed = composeSummaryBody({
      type: due.type, date: due.date, eventCount: events.length, chaseSections,
      activity: aggregated.map((item) => ({ title: item.title, summary: item.summary, severity: item.severity, count: item.count })),
    });
    if (composed.isQuiet) report.quietSummaries += 1;
    const rendered = renderAlphaCloneEmailLayout({
      layoutFamily: due.type === 'morning' ? 'morning_brief' : 'light',
      subject: composed.subject, headline: composed.subject,
      bodyHtml: composed.bodyHtml, bodyText: composed.bodyText,
      ctaLabel: 'Open dashboard', ctaUrl: defaultDashboardUrl(),
    });
    const sent = await sendEmailServer({
      tenantId: group.tenantId, userId: group.userId, to: group.email,
      subject: composed.subject, html: rendered.html, text: rendered.text, category: 'internal_notification',
      isPlatformNotification: true, templateName: `notification_digest_${due.type}`,
      idempotencyKey, internalNotificationKind: 'digest',
    });
    if (sent.success) {
      await admin.from('notification_digests').update({ status: 'sent', sent_at: new Date().toISOString(), provider_message_id: sent.emailId || null }).eq('id', digest.id);
      if (events.length) {
        await admin.from('notification_digest_events').update({ included_in_digest_id: digest.id, processed_at: new Date().toISOString(), digest_period: due.type }).in('id', events.map((event) => event.id));
      }
      report.digestsSent += 1;
    } else {
      await admin.from('notification_digests').update({ status: 'failed', metadata: { error: sent.error || 'provider_failed', aggregation_version: 2 } }).eq('id', digest.id);
      report.failed += 1;
    }
  }
  return report;
}
