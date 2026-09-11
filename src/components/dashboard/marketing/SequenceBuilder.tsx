'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import toast from 'react-hot-toast';
import EmptyState from '@/components/ui/EmptyState';

interface SequenceStep {
  id?: string;
  delay_days: number;
  subject: string;
  body: string;
}

interface Sequence {
  id: string;
  name: string;
  created_at: string;
  steps?: SequenceStep[];
}

export default function SequenceBuilder() {
  const { currentTenant } = useTenant();
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<SequenceStep[]>([{ delay_days: 0, subject: '', body: '' }]);
  const [selected, setSelected] = useState<Sequence | null>(null);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('email_sequences')
      .select('id, name, created_at')
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false });
    setSequences(data || []);
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const loadSteps = async (seq: Sequence) => {
    const { data } = await supabase
      .from('email_sequence_steps')
      .select('*')
      .eq('sequence_id', seq.id)
      .order('delay_days');
    setSelected({ ...seq, steps: data || [] });
  };

  const saveSequence = async () => {
    if (!currentTenant?.id || !name.trim()) return;
    try {
      const { data: seq, error } = await supabase
        .from('email_sequences')
        .insert({ tenant_id: currentTenant.id, name: name.trim() })
        .select()
        .single();
      if (error) throw error;

      const stepRows = steps
        .filter((s) => s.subject.trim())
        .map((s) => ({
          sequence_id: seq.id,
          delay_days: s.delay_days,
          subject: s.subject,
          body: s.body,
        }));
      if (stepRows.length) {
        await supabase.from('email_sequence_steps').insert(stepRows);
      }
      toast.success('Sequence created');
      setName('');
      setSteps([{ delay_days: 0, subject: '', body: '' }]);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
      </div>
    );
  }

  if (selected) {
    return (
      <div className="p-4 space-y-4 overflow-y-auto pb-24">
        <button onClick={() => setSelected(null)} className="text-sm text-teal-400 font-bold">
          ← Back
        </button>
        <h2 className="text-lg font-bold text-white">{selected.name}</h2>
        <div className="relative pl-6 border-l-2 border-teal-500/30 space-y-6">
          {(selected.steps || []).map((step, i) => (
            <div key={i} className="relative">
              <div className="absolute -left-[25px] w-3 h-3 rounded-full bg-teal-500" />
              <div className="bg-slate-900 border border-white/5 rounded-xl p-4">
                <div className="text-xs text-violet-400 font-bold mb-1">Day {step.delay_days}</div>
                <div className="text-sm font-bold text-white">{step.subject}</div>
                <p className="text-xs text-slate-400 mt-2 line-clamp-3">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5 overflow-y-auto pb-24">
      <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-white">New sequence</h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sequence name"
          className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-white/5 text-sm text-white"
        />
        {steps.map((step, i) => (
          <div key={i} className="space-y-2 p-3 rounded-xl bg-slate-950 border border-white/5">
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                value={step.delay_days}
                onChange={(e) => {
                  const next = [...steps];
                  next[i].delay_days = Number(e.target.value);
                  setSteps(next);
                }}
                className="w-20 h-9 px-2 rounded-lg bg-slate-900 border border-white/5 text-sm text-white"
                placeholder="Day"
              />
              <input
                value={step.subject}
                onChange={(e) => {
                  const next = [...steps];
                  next[i].subject = e.target.value;
                  setSteps(next);
                }}
                className="flex-1 h-9 px-3 rounded-lg bg-slate-900 border border-white/5 text-sm text-white"
                placeholder="Subject"
              />
              {steps.length > 1 && (
                <button onClick={() => setSteps(steps.filter((_, j) => j !== i))} className="text-red-400 p-2">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <textarea
              value={step.body}
              onChange={(e) => {
                const next = [...steps];
                next[i].body = e.target.value;
                setSteps(next);
              }}
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/5 text-sm text-white"
              placeholder="Email body"
            />
          </div>
        ))}
        <div className="flex gap-2">
          <button
            onClick={() => setSteps([...steps, { delay_days: steps.length * 3, subject: '', body: '' }])}
            className="flex items-center gap-1 text-xs font-bold text-teal-400"
          >
            <Plus className="w-3.5 h-3.5" /> Add step
          </button>
          <button onClick={saveSequence} className="ml-auto h-9 px-4 rounded-xl bg-teal-500 text-white text-xs font-bold">
            Save sequence
          </button>
        </div>
      </div>

      {sequences.length === 0 ? (
        <EmptyState icon={Mail} title="No sequences" description="Build a drip sequence to nurture leads over time." />
      ) : (
        <div className="bg-slate-900 border border-white/5 rounded-2xl divide-y divide-white/5">
          {sequences.map((s) => (
            <button key={s.id} onClick={() => loadSteps(s)} className="w-full px-4 py-3 text-left hover:bg-white/5">
              <div className="text-sm font-bold text-white">{s.name}</div>
              <div className="text-xs text-slate-500">{new Date(s.created_at).toLocaleDateString()}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
