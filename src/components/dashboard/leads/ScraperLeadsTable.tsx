'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Filter, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCurrentTenantSafe } from '@/hooks/useTenantSafe';

interface ScraperLead {
  id: string;
  name?: string;
  email?: string;
  company?: string;
  title?: string;
  score?: number;
  grade?: string;
  status?: string;
  source?: string;
}

interface Props {
  campaignId?: string | null;
}

const GRADE_COLORS: Record<string, string> = {
  A: 'text-emerald-400 bg-emerald-900/40',
  B: 'text-blue-400 bg-blue-900/40',
  C: 'text-yellow-400 bg-yellow-900/40',
  D: 'text-slate-400 bg-slate-800',
};

export default function ScraperLeadsTable({ campaignId }: Props) {
  const tenant = useCurrentTenantSafe();
  const [leads, setLeads] = useState<ScraperLead[]>([]);
  const [minScore, setMinScore] = useState('');
  const [grade, setGrade] = useState('');
  const [loading, setLoading] = useState(false);

  const loadLeads = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ tenantId: tenant.id });
      if (campaignId) params.set('campaignId', campaignId);
      if (minScore) params.set('minScore', minScore);
      if (grade) params.set('grade', grade);

      const res = await fetch(`/api/scraper-leads?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLeads(data.leads || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, campaignId, minScore, grade]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Filter className="w-4 h-4 text-purple-400" />
          Scored Leads
        </h3>
        <div className="flex items-center gap-2">
          <select
            className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-sm text-white"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
          >
            <option value="">All grades</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
          </select>
          <input
            type="number"
            placeholder="Min score"
            className="w-24 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-sm text-white"
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
          />
          <button onClick={loadLeads} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 border-b border-slate-800">
              <th className="text-left py-2 px-2">Name</th>
              <th className="text-left py-2 px-2">Email</th>
              <th className="text-left py-2 px-2">Company</th>
              <th className="text-left py-2 px-2">Title</th>
              <th className="text-center py-2 px-2">Score</th>
              <th className="text-center py-2 px-2">Grade</th>
              <th className="text-left py-2 px-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="py-2 px-2 text-white">{lead.name || '—'}</td>
                <td className="py-2 px-2 text-slate-300">{lead.email || '—'}</td>
                <td className="py-2 px-2 text-slate-300">{lead.company || '—'}</td>
                <td className="py-2 px-2 text-slate-400">{lead.title || '—'}</td>
                <td className="py-2 px-2 text-center text-white">{lead.score ?? '—'}</td>
                <td className="py-2 px-2 text-center">
                  {lead.grade ? (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${GRADE_COLORS[lead.grade] || ''}`}>
                      {lead.grade}
                    </span>
                  ) : '—'}
                </td>
                <td className="py-2 px-2 text-slate-400">{lead.status || 'new'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {leads.length === 0 && !loading && (
          <p className="text-center text-slate-500 py-8 text-sm">No leads match filters.</p>
        )}
      </div>
    </div>
  );
}
