'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Play, Pause, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCurrentTenantSafe } from '@/hooks/useTenantSafe';

interface Campaign {
  id: string;
  name: string;
  status: string;
  sources?: string[];
  daily_limit?: number;
  min_score_threshold?: number;
}

interface RunStatus {
  status: string;
  progress: number;
  current_step: string;
  source_count: number;
  enriched_count: number;
  created_count: number;
  errors?: string[];
}

interface Props {
  selectedCampaignId?: string | null;
  onSelectCampaign?: (id: string | null) => void;
}

export default function CampaignRunDashboard({ selectedCampaignId, onSelectCampaign }: Props) {
  const tenant = useCurrentTenantSafe();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const loadCampaigns = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/scraper-campaigns?tenantId=${tenant.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCampaigns(data.campaigns || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  const pollStatus = useCallback(async (campaignId: string) => {
    if (!tenant?.id) return;
    try {
      const res = await fetch(
        `/api/scraper-campaigns/${campaignId}/status?tenantId=${tenant.id}`
      );
      const data = await res.json();
      if (res.ok) setRunStatus(data);
    } catch {
      // silent poll failure
    }
  }, [tenant?.id]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    if (!selectedCampaignId || runStatus?.status === 'completed') return;
    const interval = setInterval(() => pollStatus(selectedCampaignId), 5000);
    return () => clearInterval(interval);
  }, [selectedCampaignId, pollStatus, runStatus?.status]);

  const handleRun = async (campaignId: string) => {
    if (!tenant?.id) return;
    setRunning(true);
    onSelectCampaign?.(campaignId);
    try {
      const res = await fetch(`/api/scraper-campaigns/${campaignId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Campaign run started');
      await pollStatus(campaignId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  };

  const toggleStatus = async (campaign: Campaign) => {
    if (!tenant?.id) return;
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch(`/api/scraper-campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.id, status: newStatus }),
      });
      if (!res.ok) throw new Error('Update failed');
      await loadCampaigns();
      toast.success(`Campaign ${newStatus}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const stepLabels: Record<string, string> = {
    init: 'Initializing',
    scraping: 'Scraping',
    extracting: 'ML extraction',
    enriching: 'Enriching',
    deduplicating: 'Deduplicating',
    scoring: 'Scoring',
    syncing: 'CRM sync',
    done: 'Complete',
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white font-semibold">
          <BarChart3 className="w-5 h-5 text-blue-400" />
          Campaign Runs
        </div>
        <button
          onClick={loadCampaigns}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {selectedCampaignId && runStatus && (
        <div className="rounded-lg bg-slate-800/60 p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Step</span>
            <span className="text-white">{stepLabels[runStatus.current_step] || runStatus.current_step}</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all"
              style={{ width: `${runStatus.progress}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <div className="text-slate-400">Found</div>
              <div className="text-white font-semibold">{runStatus.source_count}</div>
            </div>
            <div>
              <div className="text-slate-400">Enriched</div>
              <div className="text-white font-semibold">{runStatus.enriched_count}</div>
            </div>
            <div>
              <div className="text-slate-400">CRM created</div>
              <div className="text-white font-semibold">{runStatus.created_count}</div>
            </div>
          </div>
          {runStatus.errors && runStatus.errors.length > 0 && (
            <div className="text-xs text-red-400">
              {runStatus.errors.slice(0, 3).join('; ')}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {campaigns.length === 0 && !loading && (
          <p className="text-slate-500 text-sm">No campaigns yet. Create one above.</p>
        )}
        {campaigns.map((c) => (
          <div
            key={c.id}
            className={`flex items-center justify-between p-3 rounded-lg border ${
              selectedCampaignId === c.id ? 'border-emerald-600 bg-emerald-900/20' : 'border-slate-800'
            }`}
          >
            <div>
              <div className="text-white text-sm font-medium">{c.name}</div>
              <div className="text-xs text-slate-500">
                {(c.sources || []).join(', ')} · limit {c.daily_limit}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  c.status === 'active' ? 'bg-emerald-900 text-emerald-300' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {c.status}
              </span>
              <button
                onClick={() => toggleStatus(c)}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400"
                title={c.status === 'active' ? 'Pause' : 'Activate'}
              >
                {c.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                onClick={() => handleRun(c.id)}
                disabled={running}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs disabled:opacity-50"
              >
                <Play className="w-3 h-3" />
                Run
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
