'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Mail, Save } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import toast from 'react-hot-toast';
import EmailProviderSelector from '@/components/shared/EmailProviderSelector';
import {
  DELIVERY_PROVIDER_LABELS,
  normalizeDeliveryProvider,
  type DeliveryEmailProvider,
} from '@/lib/email/emailProviderOptions';
import Link from 'next/link';

export default function EmailProviderSettings() {
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [defaultProvider, setDefaultProvider] = useState<DeliveryEmailProvider>('auto');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [providers, setProviders] = useState<
    Array<{ id: DeliveryEmailProvider; label: string; connected: boolean; native?: boolean; campaigns?: boolean }>
  >([]);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/settings/email-provider?tenantId=${currentTenant.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setDefaultProvider(normalizeDeliveryProvider(data.defaultProvider));
      setProviders(data.connectedProviders || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load email settings');
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!currentTenant?.id) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings/email-provider', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: currentTenant.id, defaultProvider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSavedAt(data.savedAt || new Date().toISOString());
      toast.success(`Default provider: ${DELIVERY_PROVIDER_LABELS[defaultProvider]}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
      </div>
    );
  }

  const zohoConnected = providers.some((p) => p.id === 'zoho' && p.connected);

  return (
    <div className="space-y-5">
      {zohoConnected && (
        <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-4 flex gap-3">
          <Mail className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-teal-300">Zoho is your native stack</p>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Inbox, CRM sync, and <strong className="text-slate-300">Campaigns</strong> run through Zoho when connected.
              Pick below which provider delivers one-to-one email — or leave on Auto to prefer Zoho when available.
            </p>
            <Link href="/dashboard/business/campaigns" className="text-[11px] text-teal-400 font-semibold mt-2 inline-block hover:underline">
              Open Campaigns →
            </Link>
          </div>
        </div>
      )}

      <EmailProviderSelector
        value={defaultProvider}
        onChange={setDefaultProvider}
        providers={providers}
        showAuto
      />

      <div className="flex items-center justify-between gap-3 pt-2">
        <div>
          {savedAt && (
            <p className="text-[10px] text-slate-500">
              Last saved: {new Date(savedAt).toLocaleString()}
            </p>
          )}
          {!providers.some((p) => p.connected) && (
            <p className="text-[10px] text-amber-400">
              Connect an email provider under System Integrations below.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-xs font-black uppercase text-white"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save
        </button>
      </div>
    </div>
  );
}
