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
    if ((normalized.includes('client') || normalized.includes('contact')) && user?.id) {
      await queryClient.prefetchQuery({
        queryKey: ['crm', 'clients', tenantId, user.id, false, 'all', ''],
        queryFn: async () => {
          const res = await businessClientService.getClientsCursorPage(tenantId, { limit: 50 });
          if (res.error) throw new Error(res.error);
          return { clients: res.clients, total: res.pageInfo.total, cursor: res.pageInfo.nextCursor, hasMore: res.pageInfo.hasMore, page: 1 };
        },
        staleTime: PREFETCH_STALE_MS,
      });
    } else if (normalized.includes('lead') || normalized === '/dashboard/crm') {
      await queryClient.prefetchQuery({
        queryKey: tenantQueryKeys.leads(tenantId, 50),
        queryFn: async () => {
          const res = await leadService.getLeadsPage({ limit: 50 });
          if (res.error) throw new Error(res.error);
          return res;
        },
        staleTime: PREFETCH_STALE_MS,
      });
    } else if (normalized.includes('deal') || normalized.includes('pipeline')) {
      await queryClient.prefetchQuery({
        queryKey: tenantQueryKeys.deals(tenantId),
        queryFn: async () => {
          const { data, error } = await supabase
            .from('deals')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });
          if (error) throw new Error(error.message);
          return data || [];
        },
        staleTime: PREFETCH_STALE_MS,
      });
    } else if (normalized.includes('billing') || normalized.includes('invoice') || normalized.includes('finance')) {
      await queryClient.prefetchQuery({
        queryKey: tenantQueryKeys.invoices(tenantId),
        queryFn: async () => {
          const { invoices, error } = await businessInvoiceService.getInvoices(tenantId);
          if (error) throw new Error(error);
          return invoices || [];
        },
        staleTime: PREFETCH_STALE_MS,
      });
    } else if (normalized.includes('project') && user?.id && user?.role) {
      await queryClient.prefetchQuery({
        queryKey: tenantQueryKeys.projects(tenantId, user.id, user.role),
        queryFn: async () => {
          const { projects, error } = await projectService.getProjects(user.id, user.role as UserRole);
          if (error) throw new Error(error);
          return projects || [];
        },
        staleTime: PREFETCH_STALE_MS,
      });
    } else if (normalized.includes('contract')) {
      await queryClient.prefetchQuery({
        queryKey: tenantQueryKeys.contracts(tenantId),
        queryFn: async () => {
          const { data, error } = await supabase
            .from('contracts')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });
          if (error) throw new Error(error.message);
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

  let cancelled = false;
  const executePrefetch = async () => {
    // One request at a time; stop warming the old workspace on cleanup.
    for (const href of ['/dashboard/clients', '/dashboard/leads', '/dashboard/finance', '/dashboard/projects']) {
      if (cancelled) return;
      await prefetchRouteData(queryClient, href, tenantId, user);
    }
  };
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(() => void executePrefetch(), { timeout: 3000 });
    return () => { cancelled = true; window.cancelIdleCallback(handle); };
  }
  const timer = window.setTimeout(() => void executePrefetch(), 1500);
  return () => { cancelled = true; window.clearTimeout(timer); };
}
