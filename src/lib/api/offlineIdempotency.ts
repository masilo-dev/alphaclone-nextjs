import type { SupabaseClient } from '@supabase/supabase-js';

export async function findIdempotentPayload(
  admin: SupabaseClient,
  tenantId: string,
  idempotencyKey: string,
  eventType: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await admin
    .from('business_automation_events')
    .select('payload')
    .eq('tenant_id', tenantId)
    .eq('event_type', eventType)
    .filter('payload->>idempotencyKey', 'eq', idempotencyKey)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.payload || typeof data.payload !== 'object') return null;
  return data.payload as Record<string, unknown>;
}

export async function recordIdempotentPayload(
  admin: SupabaseClient,
  tenantId: string,
  idempotencyKey: string,
  eventType: string,
  result: Record<string, unknown>,
  actorUserId: string,
): Promise<void> {
  await admin.from('business_automation_events').insert({
    tenant_id: tenantId,
    event_type: eventType,
    payload: { idempotencyKey, actorUserId, ...result },
  });
}
