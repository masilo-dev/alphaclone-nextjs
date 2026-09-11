'use client';

import React, { useState } from 'react';
import { Users, Filter, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import toast from 'react-hot-toast';

type SegmentRule = { field: string; op: string; value: string };

const FIELDS = [
  { id: 'sales_stage', label: 'Sales stage' },
  { id: 'tags', label: 'Tag' },
  { id: 'industry', label: 'Industry' },
];

interface SegmentBuilderProps {
  onCount?: (n: number) => void;
  /** Maps matching CRM clients to campaign contact ids (`client:uuid`). */
  onApply?: (contactIds: string[]) => void;
}

export default function SegmentBuilder({ onCount, onApply }: SegmentBuilderProps) {
  const { currentTenant } = useTenant();
  const [rules, setRules] = useState<SegmentRule[]>([]);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const addRule = () => setRules([...rules, { field: 'sales_stage', op: 'eq', value: 'customer' }]);

  const runQuery = async (headOnly: boolean): Promise<number | string[]> => {
    if (!currentTenant?.id) return headOnly ? 0 : [];

    const applyRules = (base: ReturnType<typeof supabase.from>) => {
      let q = base.eq('tenant_id', currentTenant.id).eq('is_active', true);
      for (const r of rules) {
        if (r.field === 'sales_stage') q = q.eq('sales_stage', r.value);
        if (r.field === 'industry') q = q.ilike('industry', `%${r.value}%`);
        if (r.field === 'tags') q = q.contains('tags', [r.value]);
      }
      return q;
    };

    if (headOnly) {
      const { count } = await applyRules(supabase.from('business_clients')).select('id', { count: 'exact', head: true });
      return count ?? 0;
    }

    const { data, error } = await applyRules(supabase.from('business_clients')).select('id');
    if (error) throw error;
    return (data || []).map((row: { id: string }) => `client:${row.id}`);
  };

  const preview = async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    try {
      const count = (await runQuery(true)) as number;
      setPreviewCount(count);
      onCount?.(count);
      toast.success(`${count} contacts match`);
    } catch {
      toast.error('Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const applyToCampaign = async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    try {
      const ids = (await runQuery(false)) as string[];
      if (ids.length === 0) {
        toast.error('No contacts match this segment');
        return;
      }
      onApply?.(ids);
      setPreviewCount(ids.length);
      toast.success(`${ids.length} contacts added to audience`);
    } catch {
      toast.error('Could not apply segment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold text-white">
        <Filter className="w-4 h-4 text-teal-400" />
        Audience segment
      </div>
      <p className="text-[11px] text-slate-500">Filter CRM clients, preview the count, then apply to your campaign audience.</p>
      {rules.length === 0 ? (
        <p className="text-xs text-slate-500">Add a rule to target by sales stage, industry, or tag.</p>
      ) : null}
      {rules.map((r, i) => (
        <div key={i} className="flex gap-2 flex-wrap">
          <select
            value={r.field}
            onChange={(e) => {
              const next = [...rules];
              next[i].field = e.target.value;
              setRules(next);
            }}
            className="h-9 px-2 rounded-lg bg-slate-950 border border-white/5 text-xs text-white"
          >
            {FIELDS.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
          <input
            value={r.value}
            onChange={(e) => {
              const next = [...rules];
              next[i].value = e.target.value;
              setRules(next);
            }}
            className="flex-1 min-w-[120px] h-9 px-3 rounded-lg bg-slate-950 border border-white/5 text-xs text-white"
            placeholder="Value"
          />
          <button type="button" onClick={() => setRules(rules.filter((_, j) => j !== i))} className="text-xs text-red-400">Remove</button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2 items-center">
        <button type="button" onClick={addRule} className="text-xs font-bold text-teal-400">+ Add rule</button>
        <button
          type="button"
          onClick={() => void preview()}
          disabled={loading || rules.length === 0}
          className="h-9 px-4 rounded-xl bg-violet-500/20 text-violet-400 text-xs font-bold border border-violet-500/30 flex items-center gap-1 disabled:opacity-50"
        >
          <Users className="w-3.5 h-3.5" />
          Preview {previewCount != null ? `(${previewCount})` : ''}
        </button>
        {onApply ? (
          <button
            type="button"
            onClick={() => void applyToCampaign()}
            disabled={loading || rules.length === 0}
            className="ml-auto h-9 px-4 rounded-xl bg-teal-500/20 text-teal-300 text-xs font-bold border border-teal-500/30 flex items-center gap-1 disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            Apply to audience
          </button>
        ) : null}
      </div>
    </div>
  );
}
