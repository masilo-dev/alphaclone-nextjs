'use client';

import React, { useEffect, useState } from 'react';
import { Lock, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import toast from 'react-hot-toast';

const CHECKLIST = [
  { id: 'review', label: 'Review all journal entries for the period' },
  { id: 'reconcile', label: 'Complete bank reconciliations' },
  { id: 'ap', label: 'Verify accounts payable aging' },
  { id: 'ar', label: 'Review outstanding invoices' },
  { id: 'lock', label: 'Lock period to prevent backdated edits' },
];

export default function PeriodClosePage() {
  const { currentTenant } = useTenant();
  const storageKey = `period-close-${currentTenant?.id || 'default'}`;
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setChecked(parsed.checked || {});
        setLocked(!!parsed.locked);
      }
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const toggle = (id: string) => {
    if (locked) return;
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    localStorage.setItem(storageKey, JSON.stringify({ checked: next, locked }));
  };

  const allDone = CHECKLIST.every((c) => checked[c.id]);

  const lockPeriod = () => {
    if (!allDone) {
      toast.error('Complete all checklist items first');
      return;
    }
    setLocked(true);
    localStorage.setItem(storageKey, JSON.stringify({ checked, locked: true }));
    toast.success('Period marked as closed');
  };

  const progress = Math.round((CHECKLIST.filter((c) => checked[c.id]).length / CHECKLIST.length) * 100);

  return (
    <div className="p-4 space-y-5 overflow-y-auto pb-24 max-w-lg mx-auto">
      <div className="bg-slate-900 border border-white/5 rounded-2xl p-4">
        <h3 className="text-sm font-bold text-white mb-2">Period close progress</h3>
        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          <div className="bg-teal-500 h-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-slate-500 mt-2">{progress}% complete</p>
      </div>

      <div className="bg-slate-900 border border-white/5 rounded-2xl divide-y divide-white/5">
        {CHECKLIST.map((item) => (
          <button
            key={item.id}
            onClick={() => toggle(item.id)}
            disabled={locked}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/5 disabled:opacity-60"
          >
            {checked[item.id] ? (
              <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0" />
            ) : (
              <Circle className="w-5 h-5 text-slate-600 flex-shrink-0" />
            )}
            <span className="text-sm text-white">{item.label}</span>
          </button>
        ))}
      </div>

      <button
        onClick={lockPeriod}
        disabled={locked || !allDone}
        className="w-full h-11 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-white font-bold flex items-center justify-center gap-2"
      >
        {locked ? (
          <>
            <Lock className="w-4 h-4" /> Period locked
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" /> Close period
          </>
        )}
      </button>
    </div>
  );
}
