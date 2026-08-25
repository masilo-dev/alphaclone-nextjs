import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Emits a business event to the automation engine.
 * This event will be picked up by the cron dispatcher and trigger relevant workflows.
 */
export async function emitBusinessEvent(
  tenantId: string,
  eventType: string,
  payload: Record<string, any>
) {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from('business_automation_events')
    .insert({
      tenant_id: tenantId,
      event_type: eventType,
      payload: payload,
      processed: false
    });

  if (error) {
    console.error(`[Automation] Failed to emit event ${eventType} for tenant ${tenantId}:`, error.message);
    throw error;
  }

  console.log(`[Automation] Emitted event: ${eventType} (Tenant: ${tenantId})`);

  const { bridgeAutomationEventToTenantNotification } = await import('@/lib/audit/businessEventBridge');
  await bridgeAutomationEventToTenantNotification(tenantId, eventType, payload).catch((err) => {
    console.warn('[Automation] Tenant notification bridge failed:', err?.message || err);
  });
}
