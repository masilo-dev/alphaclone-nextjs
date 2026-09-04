/**
 * Verify terminal stop conditions before chase execution/retries.
 */

import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { ChaseInstanceRow } from '@/lib/chaser/types';
import { getChasePolicy } from '@/lib/chaser/policyRegistry';
import { isOpenTask, isOpenProject } from '@/lib/chaser/projectCompatRepository';

export async function verifyChaseStopCondition(
  chase: ChaseInstanceRow,
): Promise<{ stopped: boolean; outcome?: string }> {
  const admin = createSupabaseAdminClient();
  const policy = getChasePolicy(chase.policy_key as any);
  const stops = policy.verifiedStopOutcomes.map((s) => s.toLowerCase());

  if (chase.entity_type === 'task') {
    const { data } = await admin
      .from('tasks')
      .select('status')
      .eq('tenant_id', chase.tenant_id)
      .eq('id', chase.entity_id)
      .maybeSingle();
    const status = String(data?.status || '').toLowerCase();
    if (!isOpenTask(status)) return { stopped: true, outcome: status };
    if (stops.includes(status)) return { stopped: true, outcome: status };
  }

  if (chase.entity_type === 'invoice') {
    const { data } = await admin
      .from('business_invoices')
      .select('status')
      .eq('tenant_id', chase.tenant_id)
      .eq('id', chase.entity_id)
      .maybeSingle();
    const status = String(data?.status || '').toLowerCase();
    if (['paid', 'void', 'cancelled', 'canceled'].includes(status)) {
      return { stopped: true, outcome: status };
    }
    if (stops.includes(status)) return { stopped: true, outcome: status };
  }

  if (chase.entity_type === 'quote') {
    const { data } = await admin
      .from('quotes')
      .select('status')
      .eq('tenant_id', chase.tenant_id)
      .eq('id', chase.entity_id)
      .maybeSingle();
    const status = String(data?.status || '').toLowerCase();
    if (['accepted', 'rejected', 'expired', 'converted', 'withdrawn'].includes(status)) {
      return { stopped: true, outcome: status };
    }
  }

  if (chase.entity_type === 'contract') {
    const { data } = await admin
      .from('contracts')
      .select('status')
      .eq('tenant_id', chase.tenant_id)
      .eq('id', chase.entity_id)
      .maybeSingle();
    const status = String(data?.status || '').toLowerCase();
    if (['signed', 'declined', 'voided', 'expired', 'cancelled'].includes(status)) {
      return { stopped: true, outcome: status };
    }
  }

  if (chase.entity_type === 'project') {
    const { data } = await admin
      .from('projects')
      .select('status')
      .eq('tenant_id', chase.tenant_id)
      .eq('id', chase.entity_id)
      .maybeSingle();
    const status = String(data?.status || '').toLowerCase();
    if (!isOpenProject(status)) return { stopped: true, outcome: status };
  }

  return { stopped: false };
}
