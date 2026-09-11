import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { humanEventLabel } from '@/lib/events/businessEventTaxonomy';

export type BusinessAttentionItem = {
  eventType: string;
  title: string;
  entityType?: string | null;
  entityId?: string | null;
  createdAt: string;
  correlationId?: string | null;
};

export type BusinessAttentionDigest = {
  tenantId: string;
  since: string;
  counts: Record<string, number>;
  urgent: BusinessAttentionItem[];
  failures: BusinessAttentionItem[];
  summary: string;
};

function asItem(row: Record<string, unknown>): BusinessAttentionItem {
  const eventType = String(row.event_type || 'update');
  return {
    eventType,
    title: String(row.title || humanEventLabel(eventType)),
    entityType: (row.entity_type as string) || null,
    entityId: (row.entity_id as string) || null,
    createdAt: String(row.created_at || ''),
    correlationId: (row.correlation_id as string) || (row.idempotency_key as string) || null,
  };
}

/**
 * Ranked, tenant-scoped view of what happened — used by Bonnie briefing.
 * Does not invent reasons; only reports stored events.
 */
export async function loadBusinessAttention(tenantId: string, hours = 24): Promise<BusinessAttentionDigest> {
  const admin = createSupabaseAdminClient();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data: events } = await admin
    .from('business_automation_events')
    .select('event_type, payload, created_at, correlation_id, entity_type, entity_id, last_error')
    .eq('tenant_id', tenantId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200);

  const counts: Record<string, number> = {};
  const urgent: BusinessAttentionItem[] = [];
  const failures: BusinessAttentionItem[] = [];

  for (const row of events || []) {
    const type = String(row.event_type || '');
    counts[type] = (counts[type] || 0) + 1;
    const item = asItem({
      ...row,
      title: humanEventLabel(type),
      correlation_id: row.correlation_id || (row.payload as any)?._envelope?.correlation_id,
    });
    if (/failed|overdue|disconnected|auth_failed|security|signed|replied/i.test(type) || row.last_error) {
      if (/failed|overdue|disconnected|auth_failed/i.test(type) || row.last_error) failures.push(item);
      else urgent.push(item);
    }
  }

  const parts = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([type, count]) => `${count} ${humanEventLabel(type).toLowerCase()}`);

  return {
    tenantId,
    since,
    counts,
    urgent: urgent.slice(0, 12),
    failures: failures.slice(0, 12),
    summary: parts.length
      ? `Last ${hours}h: ${parts.join(', ')}.`
      : `No business events recorded in the last ${hours} hours.`,
  };
}
