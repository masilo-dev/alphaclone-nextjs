'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Mail, CheckCircle2, AlertCircle, XCircle, Settings } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { ModuleOverviewChrome } from '@/components/ui/os/ModuleOverviewChrome';
import DeliverabilityPanel from './DeliverabilityPanel';
import EmailProviderSettings from '../settings/EmailProviderSettings';
import toast from 'react-hot-toast';

type ProviderStatus = {
  id: string;
  label: string;
  connected: boolean;
  role: string;
  health: 'healthy' | 'rate_limited' | 'needs_reconnect' | 'config_issue' | 'unavailable';
};

const HEALTH_LABELS: Record<ProviderStatus['health'], { label: string; className: string }> = {
  healthy: { label: 'Healthy', className: 'text-emerald-400' },
  rate_limited: { label: 'Rate limited', className: 'text-amber-400' },
  needs_reconnect: { label: 'Needs reconnect', className: 'text-red-400' },
  config_issue: { label: 'Configuration issue', className: 'text-amber-400' },
  unavailable: { label: 'Unavailable', className: 'text-slate-500' },
};

function HealthIcon({ health }: { health: ProviderStatus['health'] }) {
  if (health === 'healthy') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (health === 'needs_reconnect' || health === 'unavailable') return <XCircle className="w-4 h-4 text-red-400" />;
  return <AlertCircle className="w-4 h-4 text-amber-400" />;
}

export default function MarketingDeliveryPage() {
  const { currentTenant } = useTenant();
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [resolvedLabel, setResolvedLabel] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/marketing/overview?tenantId=${currentTenant.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setProviders(json.delivery?.providers || []);
      setResolvedLabel(json.delivery?.resolvedLabel || '');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load delivery status');
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ModuleOverviewChrome moduleId="marketing" activeHref="/dashboard/marketing/delivery">
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-lg font-semibold text-[var(--ws-text-primary)]">Delivery</h1>
          <p className="text-[13px] text-[var(--ws-text-secondary)] mt-0.5">
            Connected email and social providers. AlphaClone selects automatically unless you override.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-[var(--ws-text-secondary)] mb-3">Email delivery</h2>
              <p className="text-[12px] text-[var(--ws-text-secondary)] mb-3">
                Current automatic selection: <span className="text-teal-400">{resolvedLabel || 'None connected'}</span>
              </p>
              <div className="space-y-2">
                {providers.length === 0 ? (
                  <div className="ac-workspace-panel p-6 text-center">
                    <Mail className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-[13px] text-[var(--ws-text-secondary)]">No email providers connected.</p>
                    <Link
                      href="/dashboard/marketplace"
                      className="inline-block mt-3 text-[12px] text-teal-400 hover:text-teal-300"
                    >
                      Connect a provider →
                    </Link>
                  </div>
                ) : (
                  providers.map((p) => {
                    const health = HEALTH_LABELS[p.health] || HEALTH_LABELS.unavailable;
                    return (
                      <div key={p.id} className="ac-workspace-panel p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <HealthIcon health={p.health} />
                          <div>
                            <p className="text-[13px] font-medium text-[var(--ws-text-primary)]">{p.label}</p>
                            <p className="text-[11px] text-[var(--ws-text-secondary)] capitalize">{p.role}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-[11px] font-semibold ${health.className}`}>{health.label}</p>
                          <p className="text-[10px] text-slate-500">{p.connected ? 'Connected' : 'Not connected'}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section>
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-[var(--ws-text-secondary)] mb-3 flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5" />
                Workspace defaults
              </h2>
              <div className="ac-workspace-panel p-4">
                <EmailProviderSettings />
              </div>
            </section>

            <section>
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-[var(--ws-text-secondary)] mb-3">Deliverability</h2>
              <DeliverabilityPanel />
            </section>
          </>
        )}
      </div>
    </ModuleOverviewChrome>
  );
}
