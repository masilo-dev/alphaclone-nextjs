/**
 * Fire-and-forget bridge sync from browser services to unified CRM tables.
 */
export async function requestCrmBridgeSync(
  tenantId: string,
  entity: 'deal' | 'lead' | 'client',
  entityId: string
): Promise<void> {
  try {
    await fetch('/api/crm/bridge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ tenantId, entity, entityId }),
    });
  } catch (err) {
    console.warn('[crmBridgeClient] sync failed:', err);
  }
}
