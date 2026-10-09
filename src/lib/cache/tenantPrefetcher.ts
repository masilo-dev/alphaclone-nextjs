import type { QueryClient } from '@tanstack/react-query';
import { tenantQueryKeys } from './tenantQueryKeys';
import { businessClientService } from '@/services/businessClientService';
import { leadService } from '@/services/leadService';
import { businessInvoiceService } from '@/services/businessInvoiceService';
import { projectService } from '@/services/projectService';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types';

const PREFETCH_STALE_MS = 60 * 1000;

/**
 * Prefetches data for a specific route based on navigation intent (hover/touch)
 */
export async function prefetchRouteData(
  queryClient: QueryClient,
  href: string,
  tenantId: string | undefined,
  user?: { id: string; role?: string },
) {
  if (!tenantId || !href || href === '#') return;

  const normalized = href.toLowerCase().split('?')[0];

  try {
    if (normalized.includes('client') || normalized.includes('contact')) {
      await queryClient.prefetchQuery({
        queryKey: tenantQueryKeys.clients(tenantId, 'default'),
        queryFn: async () => {
          const res = await businessClientService.getClientsCursorPage(tenantId, { limit: 25 });
          return res;
        },
        staleTime: PREFETCH_STALE_MS,
      });
    } else if (normalized.includes('lead') || normalized === '/dashboard/crm') {
      await queryClient.prefetchQuery({
        queryKey: tenantQueryKeys.leads(tenantId, 50),
        queryFn: async () => {
          const res = await leadService.getLeadsPage({ limit: 50 });
          return res;
        },
        staleTime: PREFETCH_STALE_MS,
      });
    } else if (normalized.includes('deal') || normalized.includes('pipeline')) {
      await queryClient.prefetchQuery({
        queryKey: tenantQueryKeys.deals(tenantId),
        queryFn: async () => {
          const { data } = await supabase
            .from('deals')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });
          return data || [];
        },
        staleTime: PREFETCH_STALE_MS,
      });
    } else if (normalized.includes('billing') || normalized.includes('invoice') || normalized.includes('finance')) {
      await queryClient.prefetchQuery({
        queryKey: tenantQueryKeys.invoices(tenantId),
        queryFn: async () => {
          const { invoices } = await businessInvoiceService.getInvoices(tenantId);
          return invoices || [];
        },
        staleTime: PREFETCH_STALE_MS,
      });
    } else if (normalized.includes('project') && user?.id && user?.role) {
      await queryClient.prefetchQuery({
        queryKey: tenantQueryKeys.projects(tenantId, user.id, user.role),
        queryFn: async () => {
          const { projects } = await projectService.getProjects(user.id, user.role as UserRole);
          return projects || [];
        },
        staleTime: PREFETCH_STALE_MS,
      });
    } else if (normalized.includes('contract')) {
      await queryClient.prefetchQuery({
        queryKey: tenantQueryKeys.contracts(tenantId),
        queryFn: async () => {
          const { data } = await supabase
            .from('contracts')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });
          return data || [];
        },
        staleTime: PREFETCH_STALE_MS,
      });
    }
  } catch {
    // Prefetch failures must be silent and never crash the UI
  }
}

/**
 * Scheduled idle prefetcher:
 * Warms lightweight cache for high-probability next modules during browser idle periods.
 */
export function scheduleIdlePrefetch(
  queryClient: QueryClient,
  tenantId: string | undefined,
  user?: { id: string; role?: string },
) {
  if (typeof window === 'undefined' || !tenantId) return () => {};

  const executePrefetch = () => {
    // Stagger prefetch requests by 250ms to prevent network saturation
    const targets = [
      () => prefetchRouteData(queryClient, '/dashboard/crm', tenantId, user),
      () => prefetchRouteData(queryClient, '/dashboard/leads', tenantId, user),
      () => prefetchRouteData(queryClient, '/dashboard/finance', tenantId, user),
      () => prefetchRouteData(queryClient, '/dashboard/projects', tenantId, user),
    ];

    targets.forEach((fetcher, idx) => {
      window.setTimeout(fetcher, (idx + 1) * 250);
    });
  };

  let handle: number;
  if (typeof window.requestIdleCallback === 'function') {
    handle = window.requestIdleCallback(executePrefetch, { timeout: 3000 });
    return () => window.cancelIdleCallback(handle);
  } else {
    const timer = window.setTimeout(executePrefetch, 1000);
    return () => window.clearTimeout(timer);
  }
}
