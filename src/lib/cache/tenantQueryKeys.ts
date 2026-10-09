import type { QueryClient } from '@tanstack/react-query';

/**
 * Tenant-scoped query keys ensure strict data isolation and efficient
 * stale-while-revalidate caching across the entire AlphaClone PWA.
 * 
 * Every key begins with ['tenant', tenantId, ...] so switching tenants
 * immediately invalidates or separates cache entries.
 */
export const tenantQueryKeys = {
  all: (tenantId: string) => ['tenant', tenantId] as const,

  stats: (tenantId: string, endpoint: string, period = 'last_30_days') =>
    ['tenant', tenantId, 'stats', endpoint, period] as const,

  clients: (tenantId: string, filterKey: unknown = 'all') =>
    ['tenant', tenantId, 'clients', filterKey] as const,

  leads: (tenantId: string, filterKey: unknown = 'all') =>
    ['tenant', tenantId, 'leads', filterKey] as const,

  deals: (tenantId: string, filterKey: unknown = 'all') =>
    ['tenant', tenantId, 'deals', filterKey] as const,

  invoices: (tenantId: string, filterKey: unknown = 'all') =>
    ['tenant', tenantId, 'invoices', filterKey] as const,

  projects: (tenantId: string, userId = 'all', role = 'all') =>
    ['tenant', tenantId, 'projects', userId, role] as const,

  contracts: (tenantId: string, filterKey: unknown = 'all') =>
    ['tenant', tenantId, 'contracts', filterKey] as const,

  social: (tenantId: string) =>
    ['tenant', tenantId, 'social'] as const,

  emails: (tenantId: string, folder = 'inbox') =>
    ['tenant', tenantId, 'emails', folder] as const,
};

/**
 * Invalidation helpers for targeted mutations without full application reloads
 */
export async function invalidateTenantClients(queryClient: QueryClient, tenantId: string) {
  if (!tenantId) return;
  await queryClient.invalidateQueries({
    queryKey: ['tenant', tenantId, 'clients'],
  });
  // Also invalidate legacy key if any component uses it
  await queryClient.invalidateQueries({
    queryKey: ['clients', tenantId],
  });
}

export async function invalidateTenantLeads(queryClient: QueryClient, tenantId: string) {
  if (!tenantId) return;
  await queryClient.invalidateQueries({
    queryKey: ['tenant', tenantId, 'leads'],
  });
  await queryClient.invalidateQueries({
    queryKey: ['crm', 'kanban', tenantId],
  });
}

export async function invalidateTenantDeals(queryClient: QueryClient, tenantId: string) {
  if (!tenantId) return;
  await queryClient.invalidateQueries({
    queryKey: ['tenant', tenantId, 'deals'],
  });
}

export async function invalidateTenantInvoices(queryClient: QueryClient, tenantId: string) {
  if (!tenantId) return;
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'invoices'] }),
    queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'stats'] }),
  ]);
  // Dispatch stats event for components listening to window events
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ac:crm-stats-invalidate', { detail: { tenantId } }));
  }
}

export async function invalidateTenantProjects(queryClient: QueryClient, tenantId: string) {
  if (!tenantId) return;
  await queryClient.invalidateQueries({
    queryKey: ['tenant', tenantId, 'projects'],
  });
  await queryClient.invalidateQueries({
    queryKey: ['projects'],
  });
}

export async function invalidateTenantContracts(queryClient: QueryClient, tenantId: string) {
  if (!tenantId) return;
  await queryClient.invalidateQueries({
    queryKey: ['tenant', tenantId, 'contracts'],
  });
}

export async function invalidateTenantSocial(queryClient: QueryClient, tenantId: string) {
  if (!tenantId) return;
  await queryClient.invalidateQueries({
    queryKey: ['tenant', tenantId, 'social'],
  });
}

/**
 * Purges all cached queries for a given tenant or completely wipes memory cache
 */
export function purgeTenantCache(queryClient: QueryClient, tenantId?: string) {
  if (tenantId) {
    queryClient.removeQueries({ queryKey: ['tenant', tenantId] });
    queryClient.removeQueries({ queryKey: ['clients', tenantId] });
    queryClient.removeQueries({ queryKey: ['crm', 'kanban', tenantId] });
  } else {
    queryClient.clear();
  }
}
