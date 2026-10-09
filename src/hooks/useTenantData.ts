'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { tenantQueryKeys } from '@/lib/cache/tenantQueryKeys';
import { businessInvoiceService, type BusinessInvoice } from '@/services/businessInvoiceService';
import { projectService } from '@/services/projectService';
import { leadService, type Lead } from '@/services/leadService';
import { contactService } from '@/services/contactService';
import { supabase } from '@/lib/supabase';
import type { Project, UserRole } from '@/types';

const DEFAULT_STALE_TIME_MS = 60 * 1000; // 1 minute fresh window
const DEFAULT_GC_TIME_MS = 15 * 60 * 1000; // 15 minutes in memory

/**
 * Hook to retrieve cached invoices for the current tenant.
 * Returns cached records immediately (0ms) and silently revalidates in the background.
 */
export function useTenantInvoices(tenantId: string | undefined) {
  const query = useQuery({
    queryKey: tenantId ? tenantQueryKeys.invoices(tenantId) : ['disabled'],
    queryFn: async (): Promise<BusinessInvoice[]> => {
      if (!tenantId) return [];
      const { invoices, error } = await businessInvoiceService.getInvoices(tenantId);
      if (error) throw new Error(error);
      return invoices || [];
    },
    enabled: Boolean(tenantId),
    staleTime: DEFAULT_STALE_TIME_MS,
    gcTime: DEFAULT_GC_TIME_MS,
  });

  return {
    invoices: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook to retrieve cached projects for the current tenant and user.
 */
export function useTenantProjects(tenantId: string | undefined, userId: string | undefined, role: string | undefined) {
  const query = useQuery({
    queryKey: tenantId && userId ? tenantQueryKeys.projects(tenantId, userId, role) : ['disabled'],
    queryFn: async (): Promise<Project[]> => {
      if (!userId || !role) return [];
      const { projects, error } = await projectService.getProjects(userId, role as UserRole);
      if (error) throw new Error(error);
      return (projects as unknown as Project[]) || [];
    },
    enabled: Boolean(tenantId && userId && role),
    staleTime: DEFAULT_STALE_TIME_MS,
    gcTime: DEFAULT_GC_TIME_MS,
  });

  return {
    projects: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook to retrieve cached deals for the current tenant.
 */
export function useTenantDeals(tenantId: string | undefined) {
  const query = useQuery({
    queryKey: tenantId ? tenantQueryKeys.deals(tenantId) : ['disabled'],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: Boolean(tenantId),
    staleTime: DEFAULT_STALE_TIME_MS,
    gcTime: DEFAULT_GC_TIME_MS,
  });

  return {
    deals: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook to retrieve cached contracts for the current tenant.
 */
export function useTenantContracts(tenantId: string | undefined) {
  const query = useQuery({
    queryKey: tenantId ? tenantQueryKeys.contracts(tenantId) : ['disabled'],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: Boolean(tenantId),
    staleTime: DEFAULT_STALE_TIME_MS,
    gcTime: DEFAULT_GC_TIME_MS,
  });

  return {
    contracts: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook to retrieve cached leads for the current tenant.
 */
export function useTenantLeads(tenantId: string | undefined, limit = 100) {
  const query = useQuery({
    queryKey: tenantId ? tenantQueryKeys.leads(tenantId, limit) : ['disabled'],
    queryFn: async () => {
      if (!tenantId) return { leads: [] as Lead[], pageInfo: { hasMore: false, nextCursor: null, total: 0 } };
      const res = await leadService.getLeadsPage({ limit });
      if (res.error) throw new Error(res.error);
      return res;
    },
    enabled: Boolean(tenantId),
    staleTime: DEFAULT_STALE_TIME_MS,
    gcTime: DEFAULT_GC_TIME_MS,
  });

  return {
    leads: query.data?.leads || [],
    pageInfo: query.data?.pageInfo,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook to retrieve cached unified contacts for CRM and client managers.
 */
export function useTenantUnifiedContacts(tenantId: string | undefined, limit = 100) {
  const query = useQuery({
    queryKey: tenantId ? tenantQueryKeys.clients(tenantId, `unified-${limit}`) : ['disabled'],
    queryFn: async () => {
      if (!tenantId) return { contacts: [] };
      const res = await contactService.getUnifiedContactsList({ limit });
      if (res.error) throw new Error(res.error);
      return res;
    },
    enabled: Boolean(tenantId),
    staleTime: DEFAULT_STALE_TIME_MS,
    gcTime: DEFAULT_GC_TIME_MS,
  });

  return {
    contacts: query.data?.contacts || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
