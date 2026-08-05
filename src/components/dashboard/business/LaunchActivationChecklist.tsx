'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { launchFunnelService, LaunchFunnelStep } from '@/services/launchFunnelService';
import { useTenant } from '@/contexts/TenantContext';

type ChecklistItem = {
  id: LaunchFunnelStep;
  label: string;
  href: string;
};

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: 'first_client_added', label: 'Add first client', href: '/dashboard/crm/workspace?quickAdd=true' },
  { id: 'first_invoice_started', label: 'Create first money action', href: '/dashboard/business/billing/manage?create=true' },
  { id: 'first_revenue_action_sent', label: 'Send first follow-up', href: '/dashboard/comms' },
];

export default function LaunchActivationChecklist() {
  const router = useRouter();
  const { currentTenant } = useTenant();
  const [stepState, setStepState] = useState<Record<LaunchFunnelStep, boolean>>(
    launchFunnelService.getCompletedSteps()
  );

  useEffect(() => {
    let cancelled = false;
    const syncFromDatabase = async () => {
      const updates: Partial<Record<LaunchFunnelStep, boolean>> = {};
      const tenantId = currentTenant?.id;
      try {
        let clientsQuery = supabase.from('business_clients').select('id').limit(1);
        let invoicesQuery = supabase.from('business_invoices').select('id,status').limit(1);
        let activityQuery = supabase
          .from('activity_logs')
          .select('id')
          .contains('metadata', { step: 'first_revenue_action_sent' })
          .limit(1);

        if (tenantId) {
          clientsQuery = clientsQuery.eq('tenant_id', tenantId);
          invoicesQuery = invoicesQuery.eq('tenant_id', tenantId);
          activityQuery = activityQuery.eq('tenant_id', tenantId);
        }

        const [contactsRes, invoicesRes, messagesRes] = await Promise.all([
          clientsQuery,
          invoicesQuery,
          activityQuery,
        ]);

        if ((contactsRes.data || []).length > 0) updates.first_client_added = true;
        if ((invoicesRes.data || []).length > 0) updates.first_invoice_started = true;
        if ((messagesRes.data || []).length > 0) updates.first_revenue_action_sent = true;
      } catch {
        // Keep local completion state if database probes fail.
      }

      if (!cancelled) {
        const merged = { ...launchFunnelService.getCompletedSteps(), ...updates } as Record<LaunchFunnelStep, boolean>;
        setStepState(merged);
      }
    };

    void syncFromDatabase();
    return () => {
      cancelled = true;
    };
  }, []);

  const completion = useMemo(() => {
    const done = CHECKLIST_ITEMS.filter((item) => stepState[item.id]).length;
    const total = CHECKLIST_ITEMS.length;
    const percent = Math.round((done / total) * 100);
    return { done, total, percent };
  }, [stepState]);

  const nextRecommended = useMemo(
    () => CHECKLIST_ITEMS.find((item) => !stepState[item.id]) || null,
    [stepState]
  );

  if (completion.done === completion.total) return null;

  return (
    <div className="mb-4 rounded-xl border border-teal-500/25 bg-teal-500/8 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-teal-300">First business value checklist</h3>
        <span className="text-xs text-slate-300">
          {completion.done}/{completion.total} complete
        </span>
      </div>
      {nextRecommended && (
        <p className="mb-3 text-sm text-slate-300">
          Best next step: <span className="font-semibold text-white">{nextRecommended.label}</span>
        </p>
      )}
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div className="h-full bg-teal-500 transition-all" style={{ width: `${completion.percent}%` }} />
      </div>
      <div className="space-y-1.5">
        {CHECKLIST_ITEMS.map((item) => {
          const done = stepState[item.id];
          return (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-slate-900/40"
            >
              <span className="flex items-center gap-2 text-sm text-slate-200">
                {done ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Circle className="h-4 w-4 text-slate-500" />}
                {item.label}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
