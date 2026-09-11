/**
 * Resolve active chases when domain terminal events fire.
 */

import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { transitionChaseState } from '@/lib/chaser/chaseInstanceService';
import { chaseStopForEvent, normalizeEventType } from '@/lib/events/businessEventTaxonomy';

export async function resolveChasesForDomainEvent(params: {
  tenantId: string;
  eventType: string;
  entityId?: string | null;
  entityType?: string | null;
  outcome?: string;
}): Promise<number> {
  const mapping = chaseStopForEvent(params.eventType) || chaseStopForEvent(normalizeEventType(params.eventType));
  if (!mapping && !params.entityType) return 0;

  const admin = createSupabaseAdminClient();
  let query = admin
    .from('chase_instances')
    .select('id')
    .eq('tenant_id', params.tenantId)
    .not('state', 'in', '("RESOLVED","EXHAUSTED","CANCELLED")');

  if (params.entityId) {
    query = query.eq('entity_id', params.entityId);
  }
  if (params.entityType || mapping?.entityType) {
    query = query.eq('entity_type', params.entityType || mapping!.entityType);
  }

  const { data: rows } = await query.limit(50);
  let resolved = 0;
  for (const row of rows || []) {
    const ok = await transitionChaseState(params.tenantId, row.id, {
      state: 'RESOLVED',
      terminalOutcome: params.outcome || mapping?.outcome || params.eventType,
      evidence: {
        resolved_by_event: normalizeEventType(params.eventType),
        entity_id: params.entityId,
        at: new Date().toISOString(),
      },
    });
    if (ok.ok) resolved += 1;
  }
  return resolved;
}
