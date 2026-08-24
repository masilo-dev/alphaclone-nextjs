'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { launchFunnelService, LaunchFunnelStep } from '@/services/launchFunnelService';

type ChecklistItem = {
  id: LaunchFunnelStep;
  label: string;
  href: string;
};

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: 'integration_connected', label: 'Connect one channel', href: '/dashboard/business/social' },
  { id: 'first_lead_found', label: 'Find first lead', href: '/dashboard/leads/campaigns' },
  { id: 'first_contact_captured', label: 'Capture first contact', href: '/dashboard/contacts' },
  { id: 'first_deal_created', label: 'Create first deal', href: '/dashboard/deals' },
  { id: 'first_post_scheduled', label: 'Schedule first post', href: '/dashboard/business/social' },
];

export default function LaunchActivationChecklist() {
  const router = useRouter();
  const [stepState, setStepState] = useState<Record<LaunchFunnelStep, boolean>>(
    launchFunnelService.getCompletedSteps()
  );

  useEffect(() => {
    let cancelled = false;
    const syncFromDatabase = async () => {
      const updates: Partial<Record<LaunchFunnelStep, boolean>> = {};
      try {
        const [socialRes, leadsRes, contactsRes, dealsRes] = await Promise.all([
          supabase
            .from('social_posts')
            .select('id')
            .eq('status', 'scheduled')
            .limit(1),
          supabase.from('leads').select('id').limit(1),
          supabase.from('business_clients').select('id').limit(1),
          supabase.from('deals').select('id').limit(1),
        ]);

        if ((socialRes.data || []).length > 0) updates.first_post_scheduled = true;
        if ((leadsRes.data || []).length > 0) updates.first_lead_found = true;
        if ((contactsRes.data || []).length > 0) updates.first_contact_captured = true;
        if ((dealsRes.data || []).length > 0) updates.first_deal_created = true;

        const { data: fbRows } = await supabase.from('facebook_integrations').select('id').eq('is_active', true).limit(1);
        const { data: liRows } = await supabase.from('linkedin_integrations').select('id').eq('is_active', true).limit(1);
        if ((fbRows || []).length > 0 || (liRows || []).length > 0) updates.integration_connected = true;
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
        <h3 className="text-sm font-semibold text-teal-300">First-session activation checklist</h3>
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
