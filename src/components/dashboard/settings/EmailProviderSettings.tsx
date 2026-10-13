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
import {
  EMAIL_AUTO_REPLY_MODE_LABELS,
  normalizeEmailAutoReplyMode,
  type EmailAutoReplyMode,
} from '@/lib/email/autoReplySettings';
import Link from 'next/link';

export default function EmailProviderSettings() {
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [defaultProvider, setDefaultProvider] = useState<DeliveryEmailProvider>('auto');
  const [autoReplyMode, setAutoReplyMode] = useState<EmailAutoReplyMode>('draft_only');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [providers, setProviders] = useState<
    Array<{ id: DeliveryEmailProvider; label: string; connected: boolean; native?: boolean; campaigns?: boolean }>
  >([]);

  const load = useCallback(async () => {
    if (!currentTenant?.id) { setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/settings/email-provider?tenantId=${currentTenant.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setDefaultProvider(normalizeDeliveryProvider(data.defaultProvider));
      setAutoReplyMode(normalizeEmailAutoReplyMode(data.autoReplyMode));
      setProviders(data.connectedProviders || []);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Email settings could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!currentTenant?.id || saving) return;
    if (defaultProvider !== 'auto' && !providers.some(provider => provider.id === defaultProvider && provider.connected)) {
      toast.error('Choose a connected email account or Auto before saving.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/settings/email-provider', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          defaultProvider,
          autoReplyMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSavedAt(data.savedAt || new Date().toISOString());
      toast.success('Email settings saved');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--ws-text-muted)]" />
      </div>
    );
  }

  if (!currentTenant?.id) return <p role="status">Choose a workspace to configure email.</p>;
  if (loadError) return <div role="alert" className="rounded-md border border-[var(--ws-border)] p-4"><p>{loadError}</p><button type="button" onClick={() => void load()} className="mt-2 min-h-11 rounded-md border border-[var(--ws-border)] px-3">Retry email settings</button></div>;

  const zohoConnected = providers.some((p) => p.id === 'zoho' && p.connected);

  return (
    <div className="space-y-5">
      {zohoConnected && (
        <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-4 flex gap-3">
          <Mail className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
          <div>
            <p className="type-card-description font-bold text-[var(--brand-blue-300)]">Zoho is connected</p>
            <p className="type-card-description text-[var(--ws-text-muted)] mt-1 leading-relaxed">
              Use your connected Zoho account for email. Campaign delivery is configured separately.
              Pick below which provider delivers one-to-one email — or leave on Auto to prefer Zoho when available.
            </p>
            <Link href="/dashboard/business/campaigns" className="type-ui text-teal-400 font-semibold mt-2 inline-block hover:underline">
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

      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
        <p className="type-card-description font-bold text-violet-300">AI email auto-reply</p>
        <p className="type-card-description text-[var(--ws-text-muted)] leading-relaxed">
          When Zoho receives a qualified lead email, Bonnie can draft a reply. Default is{' '}
          <strong className="text-[var(--ws-text-secondary)]">draft only</strong> — nothing sends until you review.
        </p>
        <div className="flex flex-col gap-2">
          {(Object.keys(EMAIL_AUTO_REPLY_MODE_LABELS) as EmailAutoReplyMode[]).map((mode) => (
            <label
              key={mode}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer ${
                autoReplyMode === mode
                  ? 'border-violet-500/40 bg-violet-500/10'
                  : 'border-[var(--ws-border)] hover:border-[var(--ws-border-strong)]'
              }`}
            >
              <input
                type="radio"
                name="autoReplyMode"
                value={mode}
                checked={autoReplyMode === mode}
                onChange={() => setAutoReplyMode(mode)}
                className="mt-1"
              />
              <span className="type-caption text-[var(--ws-text-secondary)]">{EMAIL_AUTO_REPLY_MODE_LABELS[mode]}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <div>
          {savedAt && (
            <p className="type-card-description text-[var(--ws-text-muted)]">
              Last saved: {new Date(savedAt).toLocaleString()}
            </p>
          )}
          {!providers.some((p) => p.connected) && (
            <p className="type-card-description text-amber-400">
              Connect an email provider under System Integrations below.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 type-caption font-black uppercase text-[var(--text-inverse)]"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save
        </button>
      </div>
    </div>
  );
}
