'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { tenantService } from '@/services/tenancy/TenantService';
import { subDays, isAfter, parseISO } from 'date-fns';

export interface MomentumScore {
  score: number;
  trend: 'up' | 'down' | 'flat';
  breakdown: {
    leadsContacted: number;
    dealsAdvanced: number;
    dealsStalled: number;
    invoicesSent: number;
    invoicesOverdue: number;
    profileComplete: boolean;
  };
  nudge: string;
  isLoading: boolean;
}

const CACHE_KEY = 'revenue_momentum_cache';
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useRevenueMomentum() {
  const [data, setData] = useState<MomentumScore>({
    score: 0,
    trend: 'flat',
    breakdown: {
      leadsContacted: 0,
      dealsAdvanced: 0,
      dealsStalled: 0,
      invoicesSent: 0,
      invoicesOverdue: 0,
      profileComplete: false,
    },
    nudge: '',
    isLoading: true,
  });

  const calculateScore = useCallback(async () => {
    const tenantId = tenantService.getCurrentTenantId();
    if (!tenantId) return;

    // Check cache
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { score, breakdown, trend, timestamp, nudge } = JSON.parse(cached);
      if (Date.now() - timestamp < REFRESH_INTERVAL) {
        setData({ score, breakdown, trend, nudge, isLoading: false });
        return;
      }
    }

    try {
      const now = new Date();
      const sevenDaysAgo = subDays(now, 7).toISOString();
      const fourteenDaysAgo = subDays(now, 14).toISOString();

      // 1. Leads Contacted (last 7 days)
      const { count: leadsContacted } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('updated_at', sevenDaysAgo)
        .not('stage', 'eq', 'lead');

      // 2. Deals Advanced (last 7 days)
      const { count: dealsAdvanced } = await supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('updated_at', sevenDaysAgo)
        .not('stage', 'eq', 'lead');

      // 3. Deals Stalled (not updated in > 7 days, not closed)
      const { count: dealsStalled } = await supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .lt('updated_at', sevenDaysAgo)
        .not('stage', 'in', '(closed_won,closed_lost)');

      // 4. Invoices Sent (last 7 days)
      const { count: invoicesSent } = await supabase
        .from('business_invoices')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'sent')
        .gte('created_at', sevenDaysAgo);

      // 5. Invoices Overdue (> 14 days)
      const { count: invoicesOverdue } = await supabase
        .from('business_invoices')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'overdue')
        .lt('due_date', fourteenDaysAgo);

      // 6. Profile Complete
      const { data: tenant } = await supabase
        .from('tenants')
        .select('logo_url, address')
        .eq('id', tenantId)
        .single();
      
      const profileComplete = !!(tenant?.logo_url && tenant?.address);

      // Calculate Points
      let score = 0;
      score += Math.min(30, (leadsContacted || 0) * 3);
      score += Math.min(30, (dealsAdvanced || 0) * 10);
      score -= (dealsStalled || 0) * 5;
      score += Math.min(10, (invoicesSent || 0) * 5);
      score -= (invoicesOverdue || 0) * 8;
      if (profileComplete) score += 10;

      // Normalize score 0-100
      score = Math.max(0, Math.min(100, score));

      // Determine Nudge
      let nudge = "Keep pushing! You're building great momentum.";
      if ((invoicesOverdue || 0) > 0) {
        nudge = `You have ${invoicesOverdue} invoices overdue by 14+ days. Collect that revenue!`;
      } else if ((dealsStalled || 0) > 0) {
        nudge = `${dealsStalled} deals haven't moved in a week. Time to follow up.`;
      } else if ((leadsContacted || 0) < 3) {
        nudge = "Outreach is low this week. Reach out to 3 more leads to boost your score.";
      }

      // Determine Trend
      let trend: 'up' | 'down' | 'flat' = 'flat';
      if (cached) {
        const lastScore = JSON.parse(cached).score;
        if (score > lastScore) trend = 'up';
        else if (score < lastScore) trend = 'down';
      }

      const breakdown = {
        leadsContacted: leadsContacted || 0,
        dealsAdvanced: dealsAdvanced || 0,
        dealsStalled: dealsStalled || 0,
        invoicesSent: invoicesSent || 0,
        invoicesOverdue: invoicesOverdue || 0,
        profileComplete,
      };

      setData({ score, trend, breakdown, nudge, isLoading: false });

      // Save to cache
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        score, breakdown, trend, nudge, timestamp: Date.now()
      }));

    } catch (err) {
      console.error('Failed to calculate momentum score:', err);
      setData(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    calculateScore();
  }, [calculateScore]);

  return data;
}
