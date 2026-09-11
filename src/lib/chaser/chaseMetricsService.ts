/**
 * Chase health metrics for dashboard and MCP.
 */

import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ACTIVE_CHASE_STATES, TERMINAL_CHASE_STATES } from '@/lib/chaser/types';
import { getUniversalChaserPhase } from '@/lib/chaser/chaseConfig';

export async function getChaseHealthMetrics(tenantId: string) {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const { data: active } = await admin
    .from('chase_instances')
    .select('id, policy_key, state, severity')
    .eq('tenant_id', tenantId)
    .in('state', Array.from(ACTIVE_CHASE_STATES));

  const { count: resolved24h } = await admin
    .from('chase_instances')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('state', 'RESOLVED')
    .gte('resolved_at', dayAgo);

  const { count: resolved7d } = await admin
    .from('chase_instances')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('state', 'RESOLVED')
    .gte('resolved_at', weekAgo);

  const { count: attempts7d } = await admin
    .from('chase_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', weekAgo);

  const { data: failedAttempts } = await admin
    .from('chase_attempts')
    .select('id', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('delivery_state', 'failed')
    .gte('created_at', weekAgo);

  const byPolicy: Record<string, number> = {};
  const byState: Record<string, number> = {};
  let critical = 0;
  for (const row of active || []) {
    byPolicy[row.policy_key] = (byPolicy[row.policy_key] || 0) + 1;
    byState[row.state] = (byState[row.state] || 0) + 1;
    if (row.severity === 'critical') critical += 1;
  }

  const { data: dueNow } = await admin
    .from('chase_instances')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('state', ['DETECTED', 'PLANNED', 'READY'])
    .lte('next_action_at', now)
    .limit(100);

  return {
    tenant_id: tenantId,
    phase: getUniversalChaserPhase(),
    generated_at: now,
    active_total: active?.length || 0,
    critical_active: critical,
    due_now: dueNow?.length || 0,
    resolved_24h: resolved24h || 0,
    resolved_7d: resolved7d || 0,
    attempts_7d: attempts7d || 0,
    failed_attempts_7d: failedAttempts?.length || 0,
    by_policy: byPolicy,
    by_state: byState,
    terminal_states: Array.from(TERMINAL_CHASE_STATES),
  };
}
