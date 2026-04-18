'use client';

import React, { useState, useCallback } from 'react';
import { ClipboardList, RefreshCw, Send } from 'lucide-react';
import toast from 'react-hot-toast';

type RecentRow = {
  id?: string;
  message: string;
  severity?: string | null;
  url?: string | null;
  created_at?: string;
};

export default function OperationsConsoleTab() {
  const [brief, setBrief] = useState<string>('');
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [area, setArea] = useState('');
  const [impact, setImpact] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadBrief = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/operations-brief');
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to load operations brief');
        return;
      }
      setBrief(data.brief || '');
      setRecent(Array.isArray(data.recent) ? data.recent : []);
    } catch {
      toast.error('Failed to load operations brief');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadBrief();
  }, [loadBrief]);

  const submitIncident = async () => {
    if (!title.trim() || !area.trim()) {
      toast.error('Title and area are required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/operations-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          area: area.trim(),
          impact: impact.trim(),
          stepsToReproduce: stepsToReproduce.trim(),
          expectedBehavior: expectedBehavior.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to save incident');
        return;
      }
      toast.success('Incident logged');
      setTitle('');
      setImpact('');
      setStepsToReproduce('');
      setExpectedBehavior('');
      await loadBrief();
    } catch {
      toast.error('Failed to save incident');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl">
      <div className="flex items-center gap-3">
        <ClipboardList className="w-7 h-7 text-teal-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Operations console</h1>
          <p className="text-slate-400 text-sm">Business-readable error snapshot plus structured incident intake.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadBrief()}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-lg font-semibold text-white mb-3">Executive brief</h2>
        <pre className="whitespace-pre-wrap text-sm text-slate-300 font-sans leading-relaxed">{brief || (loading ? 'Loading…' : 'No data.')}</pre>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Log incident</h2>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
              placeholder="Short headline"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Product area</label>
            <input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
              placeholder="e.g. Meetings, Facebook integration, Billing"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">User impact</label>
            <textarea
              value={impact}
              onChange={(e) => setImpact(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white min-h-[72px]"
              placeholder="Who is blocked and how severely?"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Steps to reproduce</label>
            <textarea
              value={stepsToReproduce}
              onChange={(e) => setStepsToReproduce(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white min-h-[88px]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Expected behavior</label>
            <textarea
              value={expectedBehavior}
              onChange={(e) => setExpectedBehavior(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white min-h-[72px]"
            />
          </div>
          <button
            type="button"
            onClick={() => void submitIncident()}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Saving…' : 'Submit to operations log'}
          </button>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold text-white mb-3">Recent telemetry</h2>
          <div className="space-y-3 max-h-[480px] overflow-y-auto custom-scrollbar text-sm">
            {recent.length === 0 ? (
              <p className="text-slate-500">No rows returned.</p>
            ) : (
              recent.map((row, idx) => (
                <div key={row.id || idx} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <p className="text-slate-200 whitespace-pre-wrap">{row.message}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                    {row.severity && <span className="uppercase">{row.severity}</span>}
                    {row.url && <span className="truncate max-w-full">{row.url}</span>}
                    {row.created_at && <span>{new Date(row.created_at).toLocaleString()}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
