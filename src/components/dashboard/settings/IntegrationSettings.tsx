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
import CustomEmailIntegration from '../business/CustomEmailIntegration';
import Microsoft365Integration from '../business/Microsoft365Integration';
import WhatsAppIntegration from '../business/WhatsAppIntegration';
import ZernioIntegration from '../business/ZernioIntegration';
import { MessageCircle } from 'lucide-react';
import { useIntegrations } from '../../../hooks/useIntegrations';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/lib/supabase';
import ModuleJumpSelect from '../common/ModuleJumpSelect';

const PREF_ROWS = [
  { id: 'enableNotifications', label: 'Enable notifications', sub: 'Receive alerts for integration events', defaultChecked: false },
  { id: 'errorReporting', label: 'Error reporting', sub: 'Share anonymous error data to improve reliability', defaultChecked: false },
  { id: 'apiKeyRotation', label: 'API key rotation', sub: 'Auto-rotate API keys every 90 days', defaultChecked: false },
  { id: 'require2fa', label: 'Require 2FA for actions', sub: 'Extra confirmation before connecting or disconnecting', defaultChecked: false },
] as const;

type PrefId = (typeof PREF_ROWS)[number]['id'];

function prefsStorageKey(tenantId: string) {
  return `integration_prefs_${tenantId}`;
}

export function IntegrationSettings() {
  const { currentTenant } = useTenant();
  const { integrations, loading, connected, refresh } = useIntegrations();
  const [activeTab, setActiveTab] = useState('providers');
  const [syncStatus, setSyncStatus] = useState<Record<string, { lastSync: string; status: 'synced' | 'syncing' | 'error' }>>({});
  const [errorLogs, setErrorLogs] = useState<Array<{ id: string; integration: string; error: string; timestamp: string }>>([]);
  const [errorLogsLoading, setErrorLogsLoading] = useState(false);
  const [prefs, setPrefs] = useState<Record<PrefId, boolean>>({
    enableNotifications: false,
    errorReporting: false,
    apiKeyRotation: false,
    require2fa: false,
  });

  useEffect(() => {
    if (!currentTenant?.id || typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(prefsStorageKey(currentTenant.id));
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Record<PrefId, boolean>>;
      setPrefs((prev) => ({ ...prev, ...parsed }));
    } catch {
      // ignore corrupt storage
    }
  }, [currentTenant?.id]);

  const updatePref = (id: PrefId, checked: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev, [id]: checked };
      if (currentTenant?.id && typeof window !== 'undefined') {
        localStorage.setItem(prefsStorageKey(currentTenant.id), JSON.stringify(next));
      }
      return next;
    });
  };

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
    { id: 'whatsapp',    label: 'WhatsApp Accounts', icon: MessageCircle },
    { id: 'preferences', label: 'Preferences',  icon: Settings     },
    { id: 'activity',    label: 'Activity',     icon: TrendingUp   },
  ];

  const connectedCount = connected.length;
  const providerCount = integrations.length;
  const errorCount = errorLogs.length;

  return (
    <div className="space-y-5 ac-scroll-full ac-enterprise-module">
      <div className="ac-workspace-panel rounded-lg p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-teal-400">Workspace Integrations</div>
            <h1 className="text-xl md:text-2xl font-bold text-white mt-1">Connections & provider setup</h1>
            <p className="text-slate-400 text-sm mt-1">
          Configure provider API keys and sender identities for this workspace.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 md:min-w-[320px]">
            <div className="rounded-lg border border-white/5 bg-slate-950/45 px-3 py-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Connected</div>
              <div className="text-lg font-bold text-white">{connectedCount}</div>
            </div>
            <div className="rounded-lg border border-white/5 bg-slate-950/45 px-3 py-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Providers</div>
              <div className="text-lg font-bold text-white">{providerCount}</div>
            </div>
            <div className="rounded-lg border border-white/5 bg-slate-950/45 px-3 py-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Errors</div>
              <div className="text-lg font-bold text-white">{errorCount}</div>
            </div>
          </div>
        </div>
      </div>

      <ModuleJumpSelect
        options={tabs.map((t) => ({ label: t.label, href: t.id }))}
        currentHref={activeTab}
        label="Integrations section"
        onNavigate={setActiveTab}
      />
      <div className="hidden md:flex gap-1 ac-workspace-panel rounded-lg p-1 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
                active ? 'bg-slate-800 text-white border border-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'providers' && connected.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-bold bg-teal-500/20 text-teal-400 rounded-full">
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
            <div className="ac-workspace-panel rounded-lg p-4">
              <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Email providers</div>
              <h2 className="text-lg font-semibold text-white mt-1">Provider credentials & sender identity</h2>
              <p className="text-sm text-slate-400 mt-1">
                Use any verified sender email from your provider account. It does not need to match your login email.
              </p>
            </div>

            <Microsoft365Integration />
            <CustomEmailIntegration />
            <BusinessSendGridIntegration />
            <BusinessResendIntegration />
            <BusinessBrevoIntegration />
          </div>
        )}

        {/* ── WhatsApp ── */}
        {activeTab === 'whatsapp' && (
          <div className="space-y-6">
            <WhatsAppIntegration />
            <ZernioIntegration />
          </div>
        )}

        {/* ── Preferences ── */}
        {activeTab === 'preferences' && (
          <div className="space-y-5">
            <div>
              <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Workspace policy</div>
              <h2 className="text-lg font-semibold text-white mt-1">Global preferences</h2>
            </div>
            <p className="text-sm text-slate-500">
              Workspace-wide integration policies. Preferences are saved per workspace on this device.
            </p>
            <div className="ac-workspace-panel rounded-lg p-6 space-y-4">
              {PREF_ROWS.map((row) => (
                <div key={row.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{row.label}</p>
                    <p className="text-xs text-slate-400">{row.sub}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs[row.id]}
                    onChange={(e) => updatePref(row.id, e.target.checked)}
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
            <div>
              <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Monitoring</div>
              <h2 className="text-lg font-semibold text-white mt-1">Integration health</h2>
            </div>
            
            <div className="ac-workspace-panel rounded-lg p-6">
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
                      <div key={int.id} className="flex items-center justify-between p-3 bg-slate-950/45 rounded-lg border border-white/5">
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
            <div className="ac-workspace-panel rounded-lg p-6">
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
