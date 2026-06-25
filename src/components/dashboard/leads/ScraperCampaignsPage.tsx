'use client';

import React, { useState } from 'react';
import { MessageSquare, Settings2 } from 'lucide-react';
import LeadFinderChat from './LeadFinderChat';
import ScraperCampaignBuilder from './ScraperCampaignBuilder';
import CampaignRunDashboard from './CampaignRunDashboard';
import ScraperLeadsTable from './ScraperLeadsTable';

type Tab = 'chat' | 'advanced';

export default function ScraperCampaignsPage() {
  const [tab, setTab] = useState<Tab>('chat');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
        <h1 className="text-2xl font-bold text-white">Lead Finder</h1>
        <p className="text-slate-400 text-sm mt-1">
          Chat in natural language — SMB leads only. Qualify, save, email, and automate from one screen.
        </p>
        </div>
        <div className="flex rounded-lg border border-slate-800 overflow-hidden">
          <button
            onClick={() => setTab('chat')}
            className={`flex items-center gap-2 px-4 py-2 text-sm ${
              tab === 'chat' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Chat
          </button>
          <button
            onClick={() => setTab('advanced')}
            className={`flex items-center gap-2 px-4 py-2 text-sm ${
              tab === 'advanced' ? 'bg-slate-700 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            Campaigns
          </button>
        </div>
      </div>

      {tab === 'chat' ? (
        <LeadFinderChat />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ScraperCampaignBuilder onCreated={() => setRefreshKey((k) => k + 1)} />
            <CampaignRunDashboard
              key={refreshKey}
              selectedCampaignId={selectedCampaignId}
              onSelectCampaign={setSelectedCampaignId}
            />
          </div>
          <ScraperLeadsTable campaignId={selectedCampaignId} />
        </div>
      )}
    </div>
  );
}
