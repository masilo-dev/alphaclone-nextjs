'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LayoutGrid, MessageSquare, Settings2, Target, Mail, Phone, Users } from 'lucide-react';
import LeadFinderProspectsView from './LeadFinderProspectsView';
import LeadFinderChat from './LeadFinderChat';
import ScraperCampaignBuilder from './ScraperCampaignBuilder';
import CampaignRunDashboard from './CampaignRunDashboard';
import ScraperLeadsTable from './ScraperLeadsTable';
import LeadFinderSystemPanel from './LeadFinderSystemPanel';
import { ModuleStatCards, type ModuleStat } from '../common/ModuleStatCards';
import { useCurrentTenantSafe } from '@/hooks/useTenantSafe';
import type { LeadFinderStats } from '@/lib/scraper/leadFinderStatsServer';

type Tab = 'prospects' | 'chat' | 'campaigns';

export default function ScraperCampaignsPage() {
  const tenant = useCurrentTenantSafe();
  const [tab, setTab] = useState<Tab>('prospects');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState<LeadFinderStats | null>(null);

  const loadStats = useCallback(async () => {
    if (!tenant?.id) return;
    try {
      const res = await fetch(`/api/scraper-campaigns/stats?tenantId=${encodeURIComponent(tenant.id)}`);
      const data = await res.json();
      if (res.ok) setStats(data.stats);
    } catch {
      // Stats row is optional — panel handles its own errors
    }
  }, [tenant?.id]);

  useEffect(() => {
    void loadStats();
  }, [loadStats, refreshKey]);

  const onActivity = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const statCards: ModuleStat[] = stats
    ? [
        {
          label: 'Discovered leads',
          value: stats.leads.total,
          sub: `${stats.campaigns.active} active campaigns`,
          Icon: Users,
          accent: 'teal',
        },
        {
          label: 'With email',
          value: stats.leads.withEmail,
          sub: stats.leads.total
            ? `${Math.round((stats.leads.withEmail / stats.leads.total) * 100)}% contactable`
            : 'Run a search to populate',
          Icon: Mail,
          accent: 'blue',
        },
        {
          label: 'In CRM',
          value: stats.pipeline.crmSynced,
          sub: `${stats.pipeline.contacted} contacted`,
          Icon: Target,
          accent: 'emerald',
        },
        {
          label: 'With phone',
          value: stats.leads.withPhone,
          sub:
            stats.system.leadSearch === 'in-process'
              ? 'In-process search on Railway'
              : 'External scraper service',
          Icon: Phone,
          accent: 'purple',
        },
      ]
    : [];

  return (
    <div className="relative flex flex-col h-full min-h-0 w-full ac-scroll-full ac-enterprise-module pb-20 md:pb-6">
      <div className="px-4 md:px-6 pt-4 md:pt-6 space-y-5 flex flex-col flex-1 min-h-0">
      <div className="flex items-start justify-between gap-4 flex-wrap shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Lead Finder</h1>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            Apollo-style SMB prospecting with live pipeline analytics. Search by niche and location, qualify leads, sync to CRM, and run outreach.
          </p>
        </div>
        <div className="flex rounded-lg border border-slate-800 overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => setTab('prospects')}
            className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
              tab === 'prospects' ? 'bg-teal-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Prospects
          </button>
          <button
            type="button"
            onClick={() => setTab('chat')}
            className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
              tab === 'chat' ? 'bg-teal-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            AI Assist
          </button>
          <button
            type="button"
            onClick={() => setTab('campaigns')}
            className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
              tab === 'campaigns' ? 'bg-slate-700 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            Campaigns
          </button>
        </div>
      </div>

      {statCards.length > 0 && <ModuleStatCards stats={statCards} />}

      {tab === 'prospects' && <LeadFinderProspectsView onActivity={onActivity} />}

      {tab === 'chat' && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] gap-4 md:gap-6 flex-1 min-h-0">
          <LeadFinderChat onActivity={onActivity} />
          <div className="hidden xl:flex xl:flex-col min-h-0">
            <LeadFinderSystemPanel />
          </div>
        </div>
      )}

      {tab === 'campaigns' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ScraperCampaignBuilder onCreated={onActivity} />
            <CampaignRunDashboard
              key={refreshKey}
              selectedCampaignId={selectedCampaignId}
              onSelectCampaign={setSelectedCampaignId}
            />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
            <ScraperLeadsTable campaignId={selectedCampaignId} showAllWhenNoCampaign />
            <LeadFinderSystemPanel compact />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
