'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../../ui/UIComponents';
import {
  Globe,
  Search,
  Star,
  TrendingUp,
  CheckCircle,
  ArrowRight,
  Settings,
  MessageSquare,
  CreditCard,
  Users,
  Calendar,
  Zap,
  Loader2,
  XCircle,
} from 'lucide-react';
import { useIntegrations } from '../../../hooks/useIntegrations';
import { TenantIntegration } from '../../../services/integrationService';
import { useRouter } from 'next/navigation';

// Category display config — purely presentational, not data
const CATEGORY_META: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> = {
  all:           { label: 'All',           icon: Globe,         color: 'text-blue-400'   },
  communication: { label: 'Communication', icon: MessageSquare, color: 'text-green-400'  },
  payment:       { label: 'Payment',       icon: CreditCard,    color: 'text-purple-400' },
  crm:           { label: 'CRM & Sales',   icon: Users,         color: 'text-orange-400' },
  productivity:  { label: 'Productivity',  icon: Calendar,      color: 'text-cyan-400'   },
  analytics:     { label: 'Analytics',     icon: TrendingUp,    color: 'text-yellow-400' },
};

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'connected':   return <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full border border-green-500/20">Connected</span>;
    case 'available':   return <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded-full border border-blue-500/20">Available</span>;
    default:            return null;
  }
}

function IntegrationCard({
  integration,
  connecting,
  onConnect,
  onDisconnect,
  onManage,
}: {
  integration: TenantIntegration;
  connecting: string | null;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
  onManage: (id: string) => void;
}) {
  const isConnected = integration.status === 'connected';
  const isBusy      = connecting === integration.id;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition-all flex flex-col"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${
            isConnected ? 'bg-teal-500/20 border-teal-500/30' : 'bg-slate-700 border-slate-600'
          }`}>
            <Globe className={`w-5 h-5 ${isConnected ? 'text-teal-400' : 'text-slate-400'}`} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-semibold text-white text-sm">{integration.name}</h3>
              {integration.popular && (
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-500/10 border border-orange-500/20 rounded-full text-xs text-orange-400">
                  <Star className="w-2.5 h-2.5" /> Featured
                </span>
              )}
              {integration.new && (
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-teal-500/10 border border-teal-500/20 rounded-full text-xs text-teal-400">
                  <Zap className="w-2.5 h-2.5" /> New
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{integration.description}</p>
          </div>
        </div>
        <StatusBadge status={integration.status} />
      </div>

      {/* Features */}
      <div className="space-y-1.5 mb-4 flex-1">
        {integration.features.slice(0, 3).map((f, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle className="w-3 h-3 text-teal-400 flex-shrink-0" />
            <span>{f}</span>
          </div>
        ))}
        {integration.features.length > 3 && (
          <p className="text-xs text-slate-500 pl-5">+{integration.features.length - 3} more</p>
        )}
      </div>

      {/* Action */}
      <div className="pt-3 border-t border-slate-700/60 flex items-center gap-2">
        {isConnected ? (
          <>
            <Button size="sm" variant="secondary" className="flex-1 text-xs" onClick={() => onDisconnect(integration.id)} disabled={isBusy}>
              {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5 mr-1" />}
              Disconnect
            </Button>
            <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => onManage(integration.id)}>
              <Settings className="w-3.5 h-3.5 mr-1" /> Settings
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            className="flex-1 text-xs"
            disabled={isBusy}
            onClick={() => onConnect(integration.id)}
          >
            {isBusy
              ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              : <ArrowRight className="w-3.5 h-3.5 mr-1" />
            }
            Connect
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export function IntegrationMarketplaceDashboard() {
  const router = useRouter();
  const { integrations, loading, connecting, connect, disconnect } = useIntegrations();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showConnectedOnly, setShowConnectedOnly] = useState(false);
  const manage = (id: string) => {
    if (id === 'claude-mcp' || id === 'manus-mcp') return router.push(`/dashboard/marketplace?mcp=${id === 'manus-mcp' ? 'manus' : 'claude'}`);
    if (id === 'chatgpt-mcp') return router.push('/dashboard/marketplace?mcp=chatgpt');
    if (id === 'stripe') return router.push('/dashboard/business/settings?tab=billing');
    router.push(`/dashboard/business/settings?tab=integrations&provider=${encodeURIComponent(id)}`);
  };

  const categories = useMemo(
    () => Object.entries(CATEGORY_META).map(([id, meta]) => ({ id, ...meta })),
    []
  );

  const filtered = useMemo(() => {
    return integrations.filter(i => {
      const matchesCat  = selectedCategory === 'all' || i.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchesQ    = !q || (i.name || '').toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q);
      const matchesConn = !showConnectedOnly || i.status === 'connected';
      return matchesCat && matchesQ && matchesConn;
    });
  }, [integrations, selectedCategory, searchQuery, showConnectedOnly]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-7 h-7 text-teal-400 animate-spin" />
      </div>
    );
  }

  const connectedCount = integrations.filter(i => i.status === 'connected').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Integration Marketplace</h2>
          <p className="text-slate-400 text-sm mt-1">
            Connect your tools to streamline your workflow.
            {connectedCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-teal-500/10 border border-teal-500/20 rounded-full text-teal-400 text-xs font-semibold">
                {connectedCount} connected
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search integrations…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300 self-center cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showConnectedOnly}
            onChange={e => setShowConnectedOnly(e.target.checked)}
            className="rounded accent-teal-500"
          />
          Connected only
        </label>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => {
          const Icon = cat.icon;
          const active = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                active ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : cat.color}`} />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(integration => (
          <IntegrationCard
            key={integration.id}
            integration={integration}
            connecting={connecting}
            onConnect={connect}
            onDisconnect={disconnect}
            onManage={manage}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-14">
          <Search className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No integrations match your filters.</p>
          <button
            onClick={() => { setSearchQuery(''); setSelectedCategory('all'); setShowConnectedOnly(false); }}
            className="mt-3 text-teal-400 text-xs underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
