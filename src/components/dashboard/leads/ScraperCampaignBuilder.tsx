'use client';

import React, { useState } from 'react';
import { Plus, Play, Target } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCurrentTenantSafe } from '@/hooks/useTenantSafe';

const SOURCES = ['website', 'directory', 'github', 'linkedin', 'twitter', 'job_boards', 'custom'];

interface Campaign {
  id: string;
  name: string;
  status: string;
  sources?: string[];
  daily_limit?: number;
}

interface Props {
  onCreated?: (campaign: Campaign) => void;
  onRun?: (campaignId: string) => void;
}

export default function ScraperCampaignBuilder({ onCreated, onRun }: Props) {
  const tenant = useCurrentTenantSafe();
  const [name, setName] = useState('');
  const [sources, setSources] = useState<string[]>(['website', 'directory']);
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [titleKeywords, setTitleKeywords] = useState('');
  const [dailyLimit, setDailyLimit] = useState(50);
  const [minScore, setMinScore] = useState(40);
  const [enrichmentLevel, setEnrichmentLevel] = useState<'basic' | 'full'>('full');
  const [saving, setSaving] = useState(false);

  const toggleSource = (source: string) => {
    setSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id || !name.trim()) {
      toast.error('Campaign name and tenant required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/scraper-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          name: name.trim(),
          status: 'paused',
          sources,
          industry: industry ? industry.split(',').map((s) => s.trim()) : [],
          location: location ? { city: location } : {},
          title_keywords: titleKeywords ? titleKeywords.split(',').map((s) => s.trim()) : [],
          daily_limit: dailyLimit,
          min_score_threshold: minScore,
          enrichment_level: enrichmentLevel,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create campaign');

      toast.success('Campaign created');
      onCreated?.(data.campaign);
      setName('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
      <div className="flex items-center gap-2 text-white font-semibold">
        <Target className="w-5 h-5 text-emerald-400" />
        Campaign Builder
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1">Campaign name</label>
        <input
          className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="SaaS CEOs — Austin"
          required
        />
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-2">Sources</label>
        <div className="flex flex-wrap gap-2">
          {SOURCES.map((source) => (
            <button
              key={source}
              type="button"
              onClick={() => toggleSource(source)}
              className={`px-3 py-1 rounded-full text-xs border ${
                sources.includes(source)
                  ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                  : 'border-slate-700 text-slate-400'
              }`}
            >
              {source}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Industry (comma-separated)</label>
          <input
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="saas, fintech"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Location</label>
          <input
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Austin, TX"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1">Title keywords (comma-separated)</label>
        <input
          className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
          value={titleKeywords}
          onChange={(e) => setTitleKeywords(e.target.value)}
          placeholder="CEO, founder, VP Sales"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Daily limit</label>
          <input
            type="number"
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
            value={dailyLimit}
            onChange={(e) => setDailyLimit(Number(e.target.value))}
            min={1}
            max={500}
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Min score</label>
          <input
            type="number"
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            min={0}
            max={100}
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Enrichment</label>
          <select
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
            value={enrichmentLevel}
            onChange={(e) => setEnrichmentLevel(e.target.value as 'basic' | 'full')}
          >
            <option value="basic">Basic</option>
            <option value="full">Full</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
      >
        <Plus className="w-4 h-4" />
        {saving ? 'Creating...' : 'Create Campaign'}
      </button>
    </form>
  );
}
