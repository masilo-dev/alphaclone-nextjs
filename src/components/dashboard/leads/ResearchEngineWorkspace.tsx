'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useCurrentTenantSafe } from '@/hooks/useTenantSafe';
import {
  Search, Globe, Mail, Phone, Building2, CheckCircle2, XCircle,
  AlertCircle, ChevronRight, SlidersHorizontal, RefreshCw, Plus,
  ExternalLink, ArrowRight, ShieldCheck, Check, Sparkles, Filter,
  Users, Layers, Download, CheckSquare, Square, Eye, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { LeadResearchResult, ResearchJob, QualificationRules, ReviewStatus } from '@/lib/research/types';

export default function ResearchEngineWorkspace() {
  const tenant = useCurrentTenantSafe();

  // Form State
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [targetCount, setTargetCount] = useState(50);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Filter Rules
  const [requireEmail, setRequireEmail] = useState(false);
  const [requirePhone, setRequirePhone] = useState(false);
  const [requireWebsite, setRequireWebsite] = useState(true);
  const [industry, setIndustry] = useState('');
  const [businessSize, setBusinessSize] = useState<'small' | 'medium' | 'large' | 'any'>('any');
  const [ownerOperated, setOwnerOperated] = useState(false);
  const [socialRequired, setSocialRequired] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');

  // Execution & Job State
  const [submitting, setSubmitting] = useState(false);
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [activeJob, setActiveJob] = useState<ResearchJob | null>(null);
  const [results, setResults] = useState<LeadResearchResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter in Results View
  const [resultsFilter, setResultsFilter] = useState<'all' | 'qualified' | 'contactable' | 'staged' | 'imported'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Detail Modal
  const [inspectingLead, setInspectingLead] = useState<LeadResearchResult | null>(null);

  // Load research jobs
  const loadJobs = useCallback(async () => {
    if (!tenant?.id) return;
    try {
      const res = await fetch(`/api/research/jobs?tenantId=${encodeURIComponent(tenant.id)}`);
      if (res.ok) {
        const data = await res.json();
        const loadedJobs = data.jobs || [];
        setJobs(loadedJobs);
        if (loadedJobs.length > 0 && !activeJob) {
          setActiveJob(loadedJobs[0]);
        }
      }
    } catch {
      // Non-blocking
    }
  }, [tenant?.id, activeJob]);

  // Load results for active job
  const loadResults = useCallback(async (jobId: string) => {
    if (!tenant?.id || !jobId) return;
    setLoadingResults(true);
    try {
      const res = await fetch(`/api/research/jobs/${jobId}/results?tenantId=${encodeURIComponent(tenant.id)}&limit=200`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch {
      // Non-blocking
    } finally {
      setLoadingResults(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (activeJob?.id) {
      loadResults(activeJob.id);
    }
  }, [activeJob?.id, loadResults]);

  // Polling for in-flight job progress
  useEffect(() => {
    if (!activeJob?.id || !tenant?.id) return;
    if (['completed', 'partially_completed', 'cancelled', 'failed'].includes(activeJob.status)) return;

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/research/jobs/${activeJob.id}?tenantId=${encodeURIComponent(tenant.id)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.job) {
            setActiveJob(data.job);
            loadResults(activeJob.id);
            if (['completed', 'partially_completed', 'cancelled', 'failed'].includes(data.job.status)) {
              loadJobs();
            }
          }
        }
      } catch {}
    }, 3000);

    return () => clearInterval(timer);
  }, [activeJob?.id, activeJob?.status, tenant?.id, loadResults, loadJobs]);

  // Submit new research job
  const handleStartResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
    if (!query.trim() && !location.trim()) {
      toast.error('Please enter a target query or location');
      return;
    }

    setSubmitting(true);
    try {
      const rules: QualificationRules = {
        requireEmail,
        requirePhone,
        requireWebsite,
        targetIndustry: industry.trim() || undefined,
        targetLocation: location.trim() || undefined,
        businessSize,
        ownerOperatedPreference: ownerOperated,
        socialPresenceRequired: socialRequired,
        customInstructions: customInstructions.trim() || undefined,
      };

      const res = await fetch('/api/research/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          query: query.trim() || 'Businesses',
          location: location.trim() || undefined,
          industry: industry.trim() || undefined,
          targetCount: Number(targetCount) || 50,
          qualificationRules: rules,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start research job');

      toast.success('Research job launched! Discovering and analyzing targets...');
      setActiveJob(data.job);
      setSelectedIds(new Set());
      await loadJobs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not launch research');
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel running job
  const handleCancelJob = async () => {
    if (!tenant?.id || !activeJob?.id) return;
    try {
      const res = await fetch(`/api/research/jobs/${activeJob.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.id, action: 'cancel' }),
      });
      if (res.ok) {
        toast.success('Research crawl cancelled');
        setActiveJob((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
        loadJobs();
      }
    } catch {
      toast.error('Failed to cancel research');
    }
  };

  // Update lead review status
  const handleUpdateStatus = async (leadId: string, status: ReviewStatus) => {
    if (!tenant?.id) return;
    try {
      const res = await fetch(`/api/research/results/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.id, status }),
      });
      if (res.ok) {
        setResults((prev) =>
          prev.map((r) => (r.id === leadId ? { ...r, review_status: status } : r))
        );
        if (inspectingLead?.id === leadId) {
          setInspectingLead((prev) => (prev ? { ...prev, review_status: status } : null));
        }
        toast.success(`Lead marked as ${status}`);
      }
    } catch {
      toast.error('Failed to update status');
    }
  };

  // Import leads to CRM
  const handleImportToCrm = async (specificIds?: string[]) => {
    if (!tenant?.id || !activeJob?.id) return;
    const idsToImport = specificIds || Array.from(selectedIds);
    if (!specificIds && idsToImport.length === 0) {
      toast.error('Select leads or click Add to CRM on a specific lead');
      return;
    }

    try {
      toast.loading('Importing approved leads into CRM...', { id: 'import-crm' });
      const res = await fetch(`/api/research/jobs/${activeJob.id}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          resultIds: idsToImport.length > 0 ? idsToImport : undefined,
          defaultStage: 'qualified',
        }),
      });

      const data = await res.json();
      toast.dismiss('import-crm');

      if (!res.ok) throw new Error(data.error || 'Failed to import leads');

      toast.success(`Successfully imported ${data.importedCount} lead${data.importedCount === 1 ? '' : 's'} into CRM!`);
      setSelectedIds(new Set());
      loadResults(activeJob.id);
    } catch (err) {
      toast.dismiss('import-crm');
      toast.error(err instanceof Error ? err.message : 'Import failed');
    }
  };

  // Bulk selection toggles
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    if (selectedIds.size === filteredResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredResults.map((r) => r.id)));
    }
  };

  // Filtered results
  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      if (resultsFilter === 'qualified' && !r.is_qualified) return false;
      if (resultsFilter === 'contactable' && !r.public_email && !r.public_phone) return false;
      if (resultsFilter === 'staged' && r.review_status !== 'staged') return false;
      if (resultsFilter === 'imported' && r.review_status !== 'imported') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = r.business_name.toLowerCase().includes(q);
        const matchEmail = (r.public_email || '').toLowerCase().includes(q);
        const matchLoc = (r.location || '').toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchLoc) return false;
      }
      return true;
    });
  }, [results, resultsFilter, searchQuery]);

  // Friendly Stage Text
  const statusPhaseText = useMemo(() => {
    if (!activeJob) return '';
    switch (activeJob.status) {
      case 'queued':
      case 'discovering':
        return 'Searching public directories and maps...';
      case 'crawling':
        return 'Analyzing business websites and extracting evidence...';
      case 'extracting':
      case 'validating':
        return 'Validating public contacts and verifying deliverability...';
      case 'qualifying':
        return 'Evaluating against qualification rules & deduplicating CRM...';
      case 'completed':
        return 'Research completed';
      case 'partially_completed':
        return 'Research completed with partial source coverage';
      case 'cancelled':
        return 'Research cancelled';
      case 'failed':
        return 'Research failed';
      default:
        return 'Processing...';
    }
  }, [activeJob]);

  const isJobRunning = activeJob && ['queued', 'discovering', 'crawling', 'extracting', 'validating', 'qualifying'].includes(activeJob.status);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Search Launch Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Globe className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Web Research & Lead Discovery</h2>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                Scrapy Engine
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Autonomous discovery across public business sources, real-time website crawling, deduplication against CRM, and evidence-backed qualification.
            </p>
          </div>

          {jobs.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500">Previous Runs:</label>
              <select
                aria-label="Select research run"
                value={activeJob?.id || ''}
                onChange={(e) => {
                  const found = jobs.find((j) => j.id === e.target.value);
                  if (found) setActiveJob(found);
                }}
                className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
              >
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.query} ({j.location || 'Global'}) — {new Date(j.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Search Launch Form */}
        <form onSubmit={handleStartResearch} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                What are you looking for?
              </label>
              <div className="relative">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. Plumbing companies, Dental clinics, SaaS agencies"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Location / Territory
              </label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Sydney, Australia, Austin TX"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="md:col-span-3 flex items-end gap-2">
              <div className="w-24">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Leads
                </label>
                <input
                  type="number"
                  min="5"
                  max="200"
                  value={targetCount}
                  onChange={(e) => setTargetCount(Number(e.target.value))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-600"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || Boolean(isJobRunning)}
                className="flex-1 h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
              >
                {submitting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Find Leads
              </button>
            </div>
          </div>

          {/* Advanced Filters Toggle */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {showAdvanced ? 'Hide Qualification Filters' : 'Custom Qualification & Verification Filters'}
            </button>

            {showAdvanced && (
              <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requireEmail}
                      onChange={(e) => setRequireEmail(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Require public verified email
                  </label>

                  <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requirePhone}
                      onChange={(e) => setRequirePhone(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Require public phone
                  </label>

                  <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requireWebsite}
                      onChange={(e) => setRequireWebsite(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Require active website
                  </label>

                  <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={socialRequired}
                      onChange={(e) => setSocialRequired(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Require social presence
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Target Industry</label>
                    <input
                      type="text"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      placeholder="e.g. Healthcare, Home Services"
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Business Scale</label>
                    <select
                      value={businessSize}
                      onChange={(e) => setBusinessSize(e.target.value as any)}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none"
                    >
                      <option value="any">Any Business Size</option>
                      <option value="small">Small Business (1-20)</option>
                      <option value="medium">Mid-Sized (20-100)</option>
                      <option value="large">Enterprise (100+)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Custom ICP Instruction</label>
                    <input
                      type="text"
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      placeholder="e.g. Must have booking form or pricing"
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Active Run Status & Progress Banner */}
      {activeJob && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  isJobRunning
                    ? 'bg-blue-50 text-blue-700 animate-pulse border border-blue-200'
                    : activeJob.status === 'completed'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${isJobRunning ? 'bg-blue-600 animate-ping' : activeJob.status === 'completed' ? 'bg-emerald-600' : 'bg-slate-500'}`} />
                {activeJob.status.toUpperCase()}
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {activeJob.query} {activeJob.location ? `in ${activeJob.location}` : ''}
                </h3>
                <p className="text-xs text-slate-500">{statusPhaseText}</p>
              </div>
            </div>

            {isJobRunning && (
              <button
                type="button"
                onClick={handleCancelJob}
                className="h-8 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
              >
                Cancel Research
              </button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500 font-medium">
              <span>Overall Progress</span>
              <span>{activeJob.progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full transition-all duration-500 ${activeJob.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-600'}`}
                style={{ width: `${activeJob.progress}%` }}
              />
            </div>
          </div>

          {/* Live Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-slate-100 text-center">
            <div className="p-2 rounded-xl bg-slate-50">
              <p className="text-lg font-bold text-slate-800">{activeJob.discovered_count}</p>
              <p className="text-xs text-slate-500">Discovered</p>
            </div>
            <div className="p-2 rounded-xl bg-slate-50">
              <p className="text-lg font-bold text-blue-600">{activeJob.processed_count}</p>
              <p className="text-xs text-slate-500">Analyzed</p>
            </div>
            <div className="p-2 rounded-xl bg-slate-50">
              <p className="text-lg font-bold text-emerald-600">{activeJob.qualified_count}</p>
              <p className="text-xs text-slate-500">Qualified</p>
            </div>
            <div className="p-2 rounded-xl bg-slate-50">
              <p className="text-lg font-bold text-amber-600">{activeJob.duplicate_count}</p>
              <p className="text-xs text-slate-500">Duplicates</p>
            </div>
            <div className="p-2 rounded-xl bg-slate-50">
              <p className="text-lg font-bold text-rose-600">{activeJob.error_count}</p>
              <p className="text-xs text-slate-500">Failed Sites</p>
            </div>
          </div>
        </div>
      )}

      {/* Results Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Discovered Businesses</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review and qualify leads before importing into your CRM. Never guess or fabricate emails.
            </p>
          </div>

          {/* Bulk Action Controls */}
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <>
                <span className="text-xs font-medium text-slate-500 mr-1">
                  {selectedIds.size} selected
                </span>
                <button
                  type="button"
                  onClick={() => handleImportToCrm()}
                  className="h-9 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Selected to CRM
                </button>
              </>
            )}

            <button
              type="button"
              onClick={selectAllFiltered}
              className="h-9 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
            >
              {selectedIds.size === filteredResults.length && filteredResults.length > 0 ? (
                <>
                  <CheckSquare className="h-3.5 w-3.5 text-blue-600" />
                  Deselect All
                </>
              ) : (
                <>
                  <Square className="h-3.5 w-3.5 text-slate-400" />
                  Select All ({filteredResults.length})
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: `All (${results.length})` },
              { id: 'qualified', label: `Qualified (${results.filter((r) => r.is_qualified).length})` },
              { id: 'contactable', label: `With Contact (${results.filter((r) => r.public_email || r.public_phone).length})` },
              { id: 'staged', label: `Staged (${results.filter((r) => r.review_status === 'staged').length})` },
              { id: 'imported', label: `Imported to CRM (${results.filter((r) => r.review_status === 'imported').length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setResultsFilter(tab.id as any)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  resultsFilter === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in results..."
              className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-800 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Table View */}
        {loadingResults ? (
          <div className="py-12 text-center text-slate-400">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
            <p className="text-sm">Loading discovered research leads...</p>
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
            <Building2 className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No leads found in this view</p>
            <p className="text-xs text-slate-400 mt-1">
              Start a new research job above or adjust your filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      aria-label="Select all leads"
                      checked={selectedIds.size > 0 && selectedIds.size === filteredResults.length}
                      onChange={selectAllFiltered}
                      className="rounded border-slate-300 text-blue-600"
                    />
                  </th>
                  <th className="p-3">Business</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Public Email</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Score</th>
                  <th className="p-3">Qualification</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredResults.map((lead) => {
                  const isSelected = selectedIds.has(lead.id);
                  return (
                    <tr
                      key={lead.id}
                      className={`hover:bg-slate-50/80 transition ${isSelected ? 'bg-blue-50/30' : ''}`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Select ${lead.business_name}`}
                          checked={isSelected}
                          onChange={() => toggleSelect(lead.id)}
                          className="rounded border-slate-300 text-blue-600"
                        />
                      </td>

                      <td className="p-3 font-medium text-slate-900">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">{lead.business_name}</span>
                          {lead.website ? (
                            <a
                              href={lead.website}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
                            >
                              {lead.domain || lead.website}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-[11px] text-slate-400">No public website</span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 text-slate-600">{lead.location || '—'}</td>

                      <td className="p-3">
                        {lead.public_email ? (
                          <span className="inline-flex items-center gap-1 text-slate-800 font-mono text-[11px]">
                            <Mail className="h-3 w-3 text-emerald-600" />
                            {lead.public_email}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">not published</span>
                        )}
                      </td>

                      <td className="p-3 text-slate-600">
                        {lead.public_phone ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                            <Phone className="h-3 w-3 text-slate-400" />
                            {lead.public_phone}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="p-3">
                        <span className="font-bold text-slate-800">{lead.qualification_score}</span>
                        <span className="text-[10px] text-slate-400">/100</span>
                      </td>

                      <td className="p-3">
                        {lead.is_qualified ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            Qualified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            <XCircle className="h-3 w-3 text-slate-400" />
                            Unqualified
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                            lead.review_status === 'imported'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : lead.review_status === 'approved'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : lead.review_status === 'rejected'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {lead.review_status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setInspectingLead(lead)}
                            className="p-1 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
                            title="Inspect Evidence & Signals"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {lead.review_status !== 'imported' ? (
                            <button
                              type="button"
                              onClick={() => handleImportToCrm([lead.id])}
                              className="h-7 inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 text-[11px] font-semibold text-white hover:bg-emerald-700 transition"
                              title="Add to CRM"
                            >
                              <Plus className="h-3 w-3" />
                              CRM
                            </button>
                          ) : (
                            <span className="text-[11px] text-blue-600 font-semibold px-2">In CRM</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lead Detail & Evidence Inspection Modal */}
      {inspectingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{inspectingLead.business_name}</h3>
                {inspectingLead.website && (
                  <a
                    href={inspectingLead.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    {inspectingLead.website}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={() => setInspectingLead(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Overview & Contact Provenance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 space-y-1">
                <span className="text-slate-500 font-medium">Public Email:</span>
                <p className="font-mono font-semibold text-slate-900">
                  {inspectingLead.public_email || 'Not publicly published'}
                </p>
                {inspectingLead.contact_page && (
                  <p className="text-[10px] text-slate-400">Found on: {inspectingLead.contact_page}</p>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 space-y-1">
                <span className="text-slate-500 font-medium">Public Phone:</span>
                <p className="font-mono font-semibold text-slate-900">
                  {inspectingLead.public_phone || 'Not found'}
                </p>
              </div>
            </div>

            {/* Description */}
            {inspectingLead.description && (
              <div className="p-3 rounded-xl bg-slate-50 text-xs">
                <span className="text-slate-500 font-medium block mb-1">Company Description:</span>
                <p className="text-slate-800 leading-relaxed">{inspectingLead.description}</p>
              </div>
            )}

            {/* Qualification Signals & Score Breakdown */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Qualification Signals ({inspectingLead.qualification_score}/100)
                </h4>
                {inspectingLead.is_qualified ? (
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Qualified
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    Unqualified
                  </span>
                )}
              </div>

              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden text-xs">
                {inspectingLead.qualification_signals.map((sig, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between bg-white">
                    <span className="text-slate-700">{sig.reason}</span>
                    <span className="font-bold text-blue-600">+{sig.score}</span>
                  </div>
                ))}
              </div>

              {inspectingLead.disqualification_reasons.length > 0 && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-xs text-rose-700 space-y-1">
                  <span className="font-semibold block">Disqualification Factors:</span>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {inspectingLead.disqualification_reasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Source URLs & Crawl Provenance */}
            <div className="space-y-1.5 text-xs">
              <span className="text-slate-500 font-medium block">Source URLs & Evidence:</span>
              <div className="p-3 rounded-xl bg-slate-50 font-mono text-[11px] text-slate-700 break-all space-y-1">
                {inspectingLead.source_urls.map((url, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                    <span>{url}</span>
                  </div>
                ))}
                <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200">
                  Crawled at: {new Date(inspectingLead.crawl_timestamp).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => handleUpdateStatus(inspectingLead.id, 'rejected')}
                className="h-9 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
              >
                Reject Lead
              </button>

              {inspectingLead.review_status !== 'imported' && (
                <button
                  type="button"
                  onClick={async () => {
                    await handleImportToCrm([inspectingLead.id]);
                    setInspectingLead(null);
                  }}
                  className="h-9 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                >
                  Add to CRM
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
