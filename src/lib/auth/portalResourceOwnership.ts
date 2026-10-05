/**
 * Canonical portal resource ownership checks.
 * Authenticated portal identity must match tenant + client on every resource lookup.
 */

export type PortalActor = {
  clientId: string;
  tenantId: string;
};

export type PortalResourceScope = {
  id: string;
  tenant_id: string;
  client_id: string | null | undefined;
};

/**
 * Returns true only when the resource belongs to the authenticated portal client.
 */
export function portalOwnsResource(
  actor: PortalActor,
  resource: PortalResourceScope | null | undefined
): boolean {
  if (!resource?.id) return false;
  if (resource.tenant_id !== actor.tenantId) return false;
  if (!resource.client_id || resource.client_id !== actor.clientId) return false;
  return true;
}

/**
 * Build PostgREST-style equality filters that every portal resource query must apply.
 */
export function portalResourceOwnershipFilters(
  actor: PortalActor,
  resourceId: string
): { id: string; tenant_id: string; client_id: string } {
  return {
    id: resourceId,
    tenant_id: actor.tenantId,
    client_id: actor.clientId,
  };
}
