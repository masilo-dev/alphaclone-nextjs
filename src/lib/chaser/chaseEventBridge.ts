/**
 * Resolve active chases when domain terminal events fire.
 */

import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { transitionChaseState } from '@/lib/chaser/chaseInstanceService';

const EVENT_TO_RESOLUTION: Record<string, { entityType: string; outcome: string }> = {
  invoice_paid: { entityType: 'invoice', outcome: 'paid' },
  payment_received: { entityType: 'invoice', outcome: 'paid' },
  task_completed: { entityType: 'task', outcome: 'completed' },
  quote_accepted: { entityType: 'quote', outcome: 'accepted' },
  quote_rejected: { entityType: 'quote', outcome: 'rejected' },
  contract_signed: { entityType: 'contract', outcome: 'signed' },
  lead_replied: { entityType: 'lead', outcome: 'replied' },
  email_received: { entityType: 'client', outcome: 'reply' },
};

export async function resolveChasesForDomainEvent(params: {
  tenantId: string;
  eventType: string;
  entityId?: string | null;
  entityType?: string | null;
  outcome?: string;
}): Promise<number> {
  const mapping = EVENT_TO_RESOLUTION[params.eventType];
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
        resolved_by_event: params.eventType,
        entity_id: params.entityId,
        at: new Date().toISOString(),
      },
    });
    if (ok.ok) resolved += 1;
  }
  return resolved;
}
