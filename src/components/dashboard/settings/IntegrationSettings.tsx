'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../../ui/UIComponents';
import {
  Settings,
  TrendingUp,
  Loader2,
  Clock,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import BusinessSendGridIntegration from '../business/SendGridIntegration';
import BusinessResendIntegration from '../business/ResendIntegration';
import BusinessBrevoIntegration from '../business/BrevoIntegration';
import { useIntegrations } from '../../../hooks/useIntegrations';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/lib/supabase';

export function IntegrationSettings() {
  const { currentTenant } = useTenant();
  const { integrations, loading, connected, refresh } = useIntegrations();
  const [activeTab, setActiveTab] = useState('providers');
  const [syncStatus, setSyncStatus] = useState<Record<string, { lastSync: string; status: 'synced' | 'syncing' | 'error' }>>({});
  const [errorLogs, setErrorLogs] = useState<Array<{ id: string; integration: string; error: string; timestamp: string }>>([]);
  const [errorLogsLoading, setErrorLogsLoading] = useState(false);

  useEffect(() => {
    const next: Record<string, { lastSync: string; status: 'synced' | 'syncing' | 'error' }> = {};
    connected.forEach((int) => {
      const ok = int.status === 'connected';
      next[int.id] = {
        lastSync: int.connectedAt || '',
        status: ok ? 'synced' : 'error',
      };
    });
    setSyncStatus(next);
  }, [connected]);

  useEffect(() => {
    if (activeTab !== 'activity' || !currentTenant?.id) {
      return;
    }
    let cancelled = false;
    (async () => {
      setErrorLogsLoading(true);
      const { data, error } = await supabase
        .from('error_logs')
        .select('id, error_type, error_message, endpoint, created_at')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(40);

      if (cancelled) return;
      setErrorLogsLoading(false);

      if (error || !data) {
        setErrorLogs([]);
        return;
      }

      setErrorLogs(
        data.map((row: { id: string; error_type?: string; error_message?: string; endpoint?: string | null; created_at?: string }) => ({
          id: row.id,
          integration: row.endpoint || row.error_type || 'system',
          error: row.error_message || 'Unknown error',
          timestamp: row.created_at || new Date().toISOString(),
        }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, currentTenant?.id]);

  const tabs = [
    { id: 'providers',   label: 'Email Providers', icon: Settings  },
    { id: 'preferences', label: 'Preferences',  icon: Settings     },
    { id: 'activity',    label: 'Activity',     icon: TrendingUp   },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Integrations</h1>
        <p className="text-slate-400 text-sm">
          Configure provider API keys and sender identities for this workspace.
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
              {tab.id === 'providers' && connected.length > 0 && (
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

        {/* ── Providers ── */}
        {activeTab === 'providers' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
              <h2 className="text-lg font-semibold text-white">Email Provider Credentials</h2>
              <p className="text-xs text-slate-400 mt-1">
                Use any verified sender email from your provider account. It does not need to match your login email.
              </p>
            </div>

            <BusinessSendGridIntegration />
            <BusinessResendIntegration />
            <BusinessBrevoIntegration />
          </div>
        )}

        {/* ── Preferences ── */}
        {activeTab === 'preferences' && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-white">Global Preferences</h2>
            <p className="text-sm text-slate-500">
              Workspace-wide integration policies are managed from Security and Billing. Toggles below are UI placeholders until synced settings are enabled.
            </p>
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
                <button
                  type="button"
                  onClick={() => refresh()}
                  className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1"
                >
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
                    const lastSyncTime = status?.lastSync
                      ? new Date(status.lastSync).toLocaleString()
                      : 'Not recorded';
                    
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
                <h3 className="text-sm font-medium text-white">Workspace error log</h3>
                <span className="text-xs text-slate-500">
                  {errorLogsLoading ? 'Loading…' : `${errorLogs.length} entries`}
                </span>
              </div>
              
              {errorLogsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
                </div>
              ) : errorLogs.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">
                  No recent errors recorded for this workspace.
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
