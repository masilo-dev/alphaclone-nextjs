'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  Download,
  Filter,
  Mail,
  RefreshCw,
  Save,
  Square,
  Star,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCurrentTenantSafe } from '@/hooks/useTenantSafe';

export interface ScraperLead {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  company_website?: string;
  score?: number;
  grade?: string;
  status?: string;
  source?: string;
  industry?: string;
  source_label?: string;
  source_id?: string;
  source_url?: string;
  crm_lead_id?: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  reach_km?: number | null;
}

interface Props {
  campaignId?: string | null;
  hasEmailOnly?: boolean;
  locationFilter?: string;
  showAllWhenNoCampaign?: boolean;
  onActionComplete?: () => void;
  onLeadsChange?: (leads: ScraperLead[]) => void;
  refreshToken?: number;
  onFocusLead?: (leadId: string) => void;
}

const GRADE_COLORS: Record<string, string> = {
  A: 'text-emerald-400 bg-emerald-900/40',
  B: 'text-blue-400 bg-blue-900/40',
  C: 'text-yellow-400 bg-yellow-900/40',
  D: 'text-slate-400 bg-slate-800',
};

function exportCsv(leads: ScraperLead[]) {
  const headers = ['name', 'email', 'phone', 'company', 'title', 'score', 'grade', 'status', 'source'];
  const rows = leads.map((l) =>
    [l.name, l.email, l.phone, l.company, l.title, l.score, l.grade, l.status, l.source]
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(',')
  );
  const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prospects-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ScraperLeadsTable({
  campaignId,
  hasEmailOnly = false,
  locationFilter,
  showAllWhenNoCampaign = false,
  onActionComplete,
  onLeadsChange,
  refreshToken = 0,
  onFocusLead,
}: Props) {
  const tenant = useCurrentTenantSafe();
  const [leads, setLeads] = useState<ScraperLead[]>([]);
  const [minScore, setMinScore] = useState('');
  const [grade, setGrade] = useState('');
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [exporting, setExporting] = useState(false);

  const loadLeads = useCallback(async () => {
    if (!tenant?.id) return;
    if (!campaignId && !showAllWhenNoCampaign) {
      setLeads([]);
      onLeadsChange?.([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ tenantId: tenant.id });
      if (campaignId) params.set('campaignId', campaignId);
      if (minScore) params.set('minScore', minScore);
      if (grade) params.set('grade', grade);
      if (hasEmailOnly) params.set('hasEmail', 'true');
      if (locationFilter) params.set('location', locationFilter);
      params.set('page', String(page));
      params.set('limit', String(pageSize));

      const res = await fetch(`/api/scraper-leads?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const next = (data.leads || []) as ScraperLead[];
      setLeads(next);
      onLeadsChange?.(next);
      setSelectedIds(new Set());
      setTotal(data.pagination?.total ?? next.length);
      setPages(data.pagination?.pages ?? 1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [
    tenant?.id,
    campaignId,
    minScore,
    grade,
    hasEmailOnly,
    locationFilter,
    showAllWhenNoCampaign,
    onLeadsChange,
    page,
    pageSize,
  ]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads, refreshToken]);

  useEffect(() => {
    setSelectedIds(new Set());
    setPage(1);
  }, [campaignId, minScore, grade, hasEmailOnly, locationFilter, pageSize]);

  const allSelected = leads.length > 0 && selectedIds.size === leads.length;
  const selectedLeads = useMemo(
    () => leads.filter((l) => selectedIds.has(l.id)),
    [leads, selectedIds]
  );

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(leads.map((l) => l.id)));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const recordFeedback = async (feedbackAction: 'save' | 'qualify' | 'contact', count: number) => {
    if (!tenant?.id) return;
    await fetch('/api/scraper-campaigns/learn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: tenant.id,
        action: 'feedback',
        feedbackAction,
        count,
        grades: selectedLeads.map((l) => l.grade).filter(Boolean),
      }),
    }).catch(() => undefined);
  };

  const runAction = async (
    action: 'qualify' | 'save' | 'automate' | 'prepare_outreach',
    extra?: Record<string, unknown>
  ) => {
    if (!tenant?.id || selectedIds.size === 0) return;
    if ((action === 'qualify' || action === 'save' || action === 'prepare_outreach') && !campaignId) {
      toast.error('Run a search first so leads belong to a campaign');
      return;
    }
    setActing(true);
    try {
      const res = await fetch('/api/scraper-campaigns/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          action,
          campaignId,
          leadIds: Array.from(selectedIds),
          channel: 'email',
          ...extra,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (action === 'qualify') {
        toast.success(`Qualified ${data.qualified ?? selectedIds.size} leads`);
        await recordFeedback('qualify', selectedIds.size);
        setLeads((prev) =>
          prev.map((l) => (selectedIds.has(l.id) ? { ...l, status: 'qualified' } : l))
        );
      } else if (action === 'save') {
        toast.success(`Saved ${data.count ?? 0} leads to CRM`);
        await recordFeedback('save', data.count ?? selectedIds.size);
      } else if (action === 'automate') {
        toast.success('Email sequence queued');
      } else if (action === 'prepare_outreach') {
        toast.success(`Prepared ${data.prepared?.length ?? data.count ?? selectedIds.size} for outreach`);
        await recordFeedback('contact', selectedIds.size);
      }
      onActionComplete?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActing(false);
    }
  };

  const handleExportAll = async () => {
    if (!tenant?.id || exporting) return;
    setExporting(true);
    const toastId = toast.loading('Preparing export...');
    const headers = ['name', 'email', 'phone', 'company', 'title', 'score', 'grade', 'status', 'source'];
    const rows: string[] = [];
    const MAX_EXPORT = 1000;
    const batchLimit = 200;
    try {
      const maxPages = Math.max(1, Math.ceil(Math.max(total, leads.length) / batchLimit));
      for (let p = 1; p <= Math.min(maxPages, Math.ceil(MAX_EXPORT / batchLimit)); p += 1) {
        const params = new URLSearchParams({ tenantId: tenant.id, page: String(p), limit: String(batchLimit) });
        if (campaignId) params.set('campaignId', campaignId);
        if (minScore) params.set('minScore', minScore);
        if (grade) params.set('grade', grade);
        if (hasEmailOnly) params.set('hasEmail', 'true');
        if (locationFilter) params.set('location', locationFilter);
        const res = await fetch(`/api/scraper-leads?${params}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Export failed');
        const batch = (data.leads || []) as ScraperLead[];
        for (const l of batch) {
          rows.push(
            [l.name, l.email, l.phone, l.company, l.title, l.score, l.grade, l.status, l.source]
              .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
              .join(',')
          );
          if (rows.length >= MAX_EXPORT) break;
        }
        if (rows.length >= MAX_EXPORT) break;
        if (batch.length < batchLimit) break;
      }

      const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prospects-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(rows.length >= MAX_EXPORT ? `Exported first ${MAX_EXPORT} leads` : `Exported ${rows.length} leads`, { id: toastId });
    } catch (err: any) {
      toast.error(err?.message || 'Export failed', { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden min-h-0 flex flex-col">
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-slate-950/80 border-b border-slate-800">
          <span className="text-xs text-slate-400 mr-1">{selectedIds.size} selected</span>
          <button
            type="button"
            disabled={acting}
            onClick={() => void runAction('qualify')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-slate-800 hover:bg-slate-700 text-white"
          >
            <Star className="w-3.5 h-3.5" /> Qualify
          </button>
          <button
            type="button"
            disabled={acting}
            onClick={() => void runAction('save')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-teal-700 hover:bg-teal-600 text-white"
          >
            <Save className="w-3.5 h-3.5" /> Save to CRM
          </button>
          <button
            type="button"
            disabled={acting}
            onClick={() => void runAction('prepare_outreach')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-blue-800 hover:bg-blue-700 text-white"
          >
            <Mail className="w-3.5 h-3.5" /> Prepare email
          </button>
          <button
            type="button"
            disabled={acting}
            onClick={() => void runAction('automate')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-purple-800 hover:bg-purple-700 text-white"
          >
            <Zap className="w-3.5 h-3.5" /> Auto-sequence
          </button>
          <button
            type="button"
            onClick={() => exportCsv(selectedLeads)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-slate-800 hover:bg-slate-700 text-slate-200"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      )}

      <div className="p-4 md:p-5 space-y-4 flex flex-col min-h-0 flex-1">
        <div className="flex items-center justify-between flex-wrap gap-3 shrink-0">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Filter className="w-4 h-4 text-teal-400" />
            Prospects
            {total > 0 && (
              <span className="text-xs font-normal text-slate-500">({total})</span>
            )}
            {locationFilter && (
              <span className="text-xs font-normal text-teal-400/90">· {locationFilter}</span>
            )}
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleExportAll()}
              disabled={exporting || total === 0}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 disabled:opacity-50"
              aria-label="Export leads"
            >
              <Download className="w-4 h-4" />
            </button>
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
            <button type="button" onClick={loadLeads} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[min(52vh,520px)] min-h-[200px] ac-scroll-full -mx-1 px-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
              <tr className="text-slate-500 border-b border-slate-800">
                <th className="py-2 px-2 w-8">
                  <button type="button" onClick={toggleAll} className="text-slate-400 hover:text-white">
                    {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="text-left py-2 px-2">Name</th>
                <th className="text-left py-2 px-2">Email</th>
                <th className="text-left py-2 px-2">Phone</th>
                <th className="text-left py-2 px-2">Company</th>
                <th className="text-left py-2 px-2 hidden lg:table-cell">Location / source</th>
                <th className="text-center py-2 px-2 hidden md:table-cell">Reach</th>
                <th className="text-center py-2 px-2">Score</th>
                <th className="text-center py-2 px-2">Grade</th>
                <th className="text-left py-2 px-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className={`border-b border-slate-800/50 hover:bg-slate-800/30 ${
                    selectedIds.has(lead.id) ? 'bg-teal-500/5' : ''
                  }`}
                >
                  <td className="py-2 px-2">
                    <button type="button" onClick={() => toggleOne(lead.id)} className="text-slate-400 hover:text-teal-400">
                      {selectedIds.has(lead.id) ? (
                        <CheckSquare className="w-4 h-4 text-teal-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                  <td className="py-2 px-2">
                    <button
                      type="button"
                      className="text-left text-white hover:text-teal-300"
                      onClick={() => onFocusLead?.(lead.id)}
                    >
                      <div className="font-medium">{lead.name || '—'}</div>
                      {lead.title && (
                        <div className="text-[11px] text-teal-400/90">{lead.title}</div>
                      )}
                    </button>
                  </td>
                  <td className="py-2 px-2 text-slate-300">{lead.email || '—'}</td>
                  <td className="py-2 px-2 text-slate-300">{lead.phone || '—'}</td>
                  <td className="py-2 px-2 text-slate-300">{lead.company || '—'}</td>
                  <td className="py-2 px-2 text-slate-400 text-xs hidden lg:table-cell max-w-[160px] truncate">
                    {lead.address || lead.source_label || lead.industry || lead.source || '—'}
                  </td>
                  <td className="py-2 px-2 text-center text-slate-300 tabular-nums text-xs hidden md:table-cell">
                    {lead.reach_km != null ? `${lead.reach_km} km` : '—'}
                  </td>
                  <td className="py-2 px-2 text-center text-white tabular-nums">{lead.score ?? '—'}</td>
                  <td className="py-2 px-2 text-center">
                    {lead.grade ? (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${GRADE_COLORS[lead.grade] || ''}`}>
                        {lead.grade}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2 px-2 text-slate-400 capitalize">{lead.status || 'new'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {total === 0 && !loading && (
            <p className="text-center text-slate-500 py-10 text-sm">
              {campaignId ? 'No leads match these filters.' : showAllWhenNoCampaign ? 'No leads yet.' : 'Run a search to see leads here.'}
            </p>
          )}
        </div>

        {total > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1 text-xs text-slate-500">
            <p>
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <select
                value={String(pageSize)}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-sm text-white"
                aria-label="Leads per page"
              >
                <option value="25">25 / page</option>
                <option value="50">50 / page</option>
                <option value="100">100 / page</option>
                <option value="200">200 / page</option>
              </select>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-slate-400 font-semibold">
                Page {page} / {pages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
