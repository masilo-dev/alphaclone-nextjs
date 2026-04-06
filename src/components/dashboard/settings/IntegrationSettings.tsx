'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../../ui/UIComponents';
import {
  Settings,
  Globe,
  TrendingUp,
  CheckCircle,
  ArrowRight,
  Loader2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { SlackIntegration } from '../integrations/SlackIntegration';
import { SendGridIntegration } from '../integrations/SendGridIntegration';
import { ResendIntegration } from '../integrations/ResendIntegration';
import { PlaywrightIntegration } from '../integrations/PlaywrightIntegration';
import { IntegrationMarketplaceDashboard } from '../integrations/IntegrationMarketplaceDashboard';
import { useIntegrations } from '../../../hooks/useIntegrations';

export function IntegrationSettings() {
  const { integrations, loading, connected, disconnect } = useIntegrations();
  const [activeTab, setActiveTab] = useState('marketplace');
  const [syncStatus, setSyncStatus] = useState<Record<string, { lastSync: string; status: 'synced' | 'syncing' | 'error' }>>({});
  const [errorLogs, setErrorLogs] = useState<Array<{ id: string; integration: string; error: string; timestamp: string }>>([]);

  // Simulate sync status updates
  useEffect(() => {
    const interval = setInterval(() => {
      const newStatus: Record<string, { lastSync: string; status: 'synced' | 'syncing' | 'error' }> = {};
      connected.forEach(int => {
        const isHealthy = Math.random() > 0.1; // 90% healthy
        newStatus[int.id] = {
          lastSync: new Date(Date.now() - Math.random() * 3600000).toISOString(),
          status: isHealthy ? 'synced' : 'error'
        };
      });
      setSyncStatus(newStatus);
    }, 30000); // Update every 30 seconds

    // Initialize with mock data
    const initialStatus: Record<string, { lastSync: string; status: 'synced' | 'syncing' | 'error' }> = {};
    connected.forEach(int => {
      initialStatus[int.id] = {
        lastSync: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        status: 'synced'
      };
    });
    setSyncStatus(initialStatus);

    // Mock error logs
    setErrorLogs([
      { id: '1', integration: 'slack', error: 'Rate limit exceeded (429)', timestamp: new Date(Date.now() - 3600000).toISOString() },
      { id: '2', integration: 'sendgrid', error: 'API key invalid', timestamp: new Date(Date.now() - 7200000).toISOString() },
    ]);

    return () => clearInterval(interval);
  }, [connected]);

  const tabs = [
    { id: 'marketplace', label: 'Marketplace',  icon: Globe        },
    { id: 'connected',   label: 'Connected',    icon: CheckCircle  },
    { id: 'preferences', label: 'Preferences',  icon: Settings     },
    { id: 'activity',    label: 'Activity',     icon: TrendingUp   },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Integrations</h1>
        <p className="text-slate-400 text-sm">
          Connect tools that power your workflow. All connections are stored securely per workspace.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
                active ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'connected' && connected.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-teal-500/20 text-teal-400 rounded-full">
                  {connected.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">

        {/* ── Marketplace ── */}
        {activeTab === 'marketplace' && <IntegrationMarketplaceDashboard />}

        {/* ── Connected ── */}
        {activeTab === 'connected' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Connected Integrations</h2>
              <span className="text-sm text-slate-400">
                {loading ? '…' : `${connected.length} of ${integrations.length} connected`}
              </span>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
              </div>
            ) : connected.length > 0 ? (
              <div className="space-y-4">
                {/* Config panels for integrations that have dedicated UI */}
                {connected.some(i => i.id === 'slack')    && <SlackIntegration />}
                {connected.some(i => i.id === 'sendgrid') && <SendGridIntegration />}
                {connected.some(i => i.id === 'resend')   && <ResendIntegration />}
                {connected.some(i => i.id === 'playwright') && <PlaywrightIntegration />}

                {/* Generic disconnect cards for everything else */}
                {connected
                  .filter(i => !['slack','sendgrid','resend','playwright'].includes(i.id))
                  .map(int => (
                    <motion.div
                      key={int.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                          <Globe className="w-5 h-5 text-teal-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-white text-sm">{int.name}</p>
                          <p className="text-xs text-slate-400">{int.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-xs text-teal-400">
                          <CheckCircle className="w-3.5 h-3.5" /> Connected
                        </span>
                        <button
                          onClick={() => disconnect(int.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                          title="Disconnect"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-14">
                <Globe className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                <h3 className="text-base font-semibold text-white mb-2">No integrations connected yet</h3>
                <p className="text-slate-400 text-sm mb-5">
                  Head to the Marketplace tab to connect your first integration.
                </p>
                <Button onClick={() => setActiveTab('marketplace')}>
                  <ArrowRight className="w-4 h-4 mr-2" /> Browse Marketplace
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Preferences ── */}
        {activeTab === 'preferences' && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-white">Global Preferences</h2>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4">
              {[
                { label: 'Enable notifications', sub: 'Receive alerts for integration events', defaultChecked: true },
                { label: 'Error reporting',       sub: 'Share anonymous error data to improve reliability', defaultChecked: true },
                { label: 'API key rotation',      sub: 'Auto-rotate API keys every 90 days', defaultChecked: false },
                { label: 'Require 2FA for actions', sub: 'Extra confirmation before connecting or disconnecting', defaultChecked: false },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{row.label}</p>
                    <p className="text-xs text-slate-400">{row.sub}</p>
                  </div>
                  <input
                    type="checkbox"
                    defaultChecked={row.defaultChecked}
                    className="rounded accent-teal-500 w-4 h-4"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Activity ── */}
        {activeTab === 'activity' && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-white">Integration Health</h2>
            
            {/* Sync Status */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white">Sync Status</h3>
                <button className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
              
              {connected.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">
                  No integrations connected. Connect an integration to monitor sync status.
                </p>
              ) : (
                <div className="space-y-3">
                  {connected.map(int => {
                    const status = syncStatus[int.id];
                    const isHealthy = status?.status === 'synced';
                    const lastSyncTime = status?.lastSync ? new Date(status.lastSync).toLocaleString() : 'Never';
                    
                    return (
                      <div key={int.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className="text-sm text-white">{int.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`text-xs ${isHealthy ? 'text-green-400' : 'text-red-400'}`}>
                            {isHealthy ? 'Synced' : 'Error'}
                          </span>
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {lastSyncTime}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Error Logs */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white">Error Logs</h3>
                <span className="text-xs text-slate-500">{errorLogs.length} errors</span>
              </div>
              
              {errorLogs.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">
                  No errors logged. All integrations are running smoothly.
                </p>
              ) : (
                <div className="space-y-3">
                  {errorLogs.map(log => (
                    <div key={log.id} className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-red-300 capitalize">{log.integration}</span>
                            <span className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-slate-400">{log.error}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
