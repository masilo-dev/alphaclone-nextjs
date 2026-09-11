'use client';

import React, { useState } from 'react';
import { Users, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import toast from 'react-hot-toast';

type SegmentRule = { field: string; op: string; value: string };

const FIELDS = [
  { id: 'sales_stage', label: 'Sales stage' },
  { id: 'tags', label: 'Tag' },
  { id: 'industry', label: 'Industry' },
];

export default function SegmentBuilder({ onCount }: { onCount?: (n: number) => void }) {
  const { currentTenant } = useTenant();
  const [rules, setRules] = useState<SegmentRule[]>([]);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const addRule = () => setRules([...rules, { field: 'sales_stage', op: 'eq', value: 'customer' }]);

  const preview = async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    try {
      let query = supabase.from('business_clients').select('id', { count: 'exact', head: true }).eq('tenant_id', currentTenant.id).eq('is_active', true);
      for (const r of rules) {
        if (r.field === 'sales_stage') query = query.eq('sales_stage', r.value);
        if (r.field === 'industry') query = query.ilike('industry', `%${r.value}%`);
      }
      const { count } = await query;
      setPreviewCount(count ?? 0);
      onCount?.(count ?? 0);
      toast.success(`${count ?? 0} contacts match`);
    } catch {
      toast.error('Preview failed');
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
          <button onClick={() => setRules(rules.filter((_, j) => j !== i))} className="text-xs text-red-400">Remove</button>
        </div>
      ))}
      <div className="flex gap-2 items-center">
        <button onClick={addRule} className="text-xs font-bold text-teal-400">+ Add rule</button>
        <button
          onClick={preview}
          disabled={loading}
          className="ml-auto h-9 px-4 rounded-xl bg-violet-500/20 text-violet-400 text-xs font-bold border border-violet-500/30 flex items-center gap-1"
        >
          <Users className="w-3.5 h-3.5" />
          Preview {previewCount != null ? `(${previewCount})` : ''}
        </button>
      </div>
    </div>
  );
}
