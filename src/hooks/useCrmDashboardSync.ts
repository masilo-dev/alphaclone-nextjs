'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { clearDashboardStatsClientCache } from '@/lib/crm/invalidateCrmCaches';

const CRM_EVENT_PREFIX = 'crm.';
const OUTREACH_EVENT_PREFIX = 'outreach.';
const CAMPAIGN_EVENT_PREFIX = 'campaign.';

/**
 * Subscribe to domain_events + leads changes and invalidate dashboard client caches.
 * Prevents stale KPI counts after MCP/API lead mutations.
 */
export function useCrmDashboardSync(tenantId: string | undefined) {
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`crm-dashboard-sync-${tenantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'domain_events', filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          const eventType = String((payload.new as { event_type?: string })?.event_type || '');
          if (
            eventType.startsWith(CRM_EVENT_PREFIX) ||
            eventType.startsWith(OUTREACH_EVENT_PREFIX) ||
            eventType.startsWith(CAMPAIGN_EVENT_PREFIX)
          ) {
            clearDashboardStatsClientCache(tenantId);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);
}
