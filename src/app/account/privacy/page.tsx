'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import CookieBanner from '@/components/legal/CookieBanner';

type Prefs = {
  transactional: boolean;
  product_updates: boolean;
  marketing: boolean;
  sms: boolean;
};

const DEFAULT_PREFS: Prefs = {
  transactional: true,
  product_updates: true,
  marketing: false,
  sms: false,
};

export default function PrivacyCenterPage() {
  const { user, loading } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [connectedApps, setConnectedApps] = useState([
    { label: 'Google', connected: false },
    { label: 'Microsoft', connected: false },
    { label: 'Meta', connected: false },
    { label: 'LinkedIn', connected: false },
  ]);

  useEffect(() => {
    const loadPrefs = async () => {
      if (!user) return;
      const { data, error } = await supabase.from('profiles').select('communication_prefs').eq('id', user.id).maybeSingle();
      if (!error && data?.communication_prefs) {
        setPrefs({
          transactional: data.communication_prefs.transactional !== false,
          product_updates: data.communication_prefs.product_updates !== false,
          marketing: Boolean(data.communication_prefs.marketing),
          sms: Boolean(data.communication_prefs.sms),
        });
      }
    };
    void loadPrefs();
  }, [user]);

  const savePrefs = async () => {
    if (!user) return;
    setSaving(true);
    setStatus(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch('/api/account/communication-prefs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
        },
        body: JSON.stringify({
          communicationPrefs: prefs,
          source: 'account-privacy',
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Unable to save preferences');
      setStatus('Preferences saved.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const exportData = async () => {
    setExporting(true);
    setStatus(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch('/api/legal/data-export', {
        headers: {
          ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
        },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Export failed');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `alphaclone-data-export-${user?.id ?? 'user'}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Your export is downloading.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const revokeApp = async (label: string) => {
    setStatus(`${label} revoke request opened. Disconnect flow can be completed from the integrations area.`);
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 px-6 py-20 text-slate-200">Loading privacy center...</div>;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200">
      <CookieBanner />
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.25em] text-teal-400">Account Privacy</p>
          <h1 className="mt-2 text-4xl font-semibold text-white">Privacy & Consent Center</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
            Review what AlphaClone stores, manage your communication preferences, and trigger export or deletion flows
            from one place.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold text-white">Your data summary</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <p>Account created: {user ? 'Available in profile data' : 'Sign in required'}</p>
              <p>Stored data: profile, CRM data, emails sent, invoices, and contracts.</p>
            </div>
            <div className="mt-5">
              <button
                type="button"
                onClick={exportData}
                disabled={exporting || !user}
                className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exporting ? 'Preparing export...' : 'Export my data'}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold text-white">Communication preferences</h2>
            <div className="mt-4 space-y-3 text-sm">
              <ToggleRow label="Transactional emails" checked disabled description="Required for receipts, security alerts, and account notifications." />
              <ToggleRow label="Product updates / changelog" checked={prefs.product_updates} onToggle={() => setPrefs((prev) => ({ ...prev, product_updates: !prev.product_updates }))} description="Optional product updates and release notes." />
              <ToggleRow label="Marketing emails" checked={prefs.marketing} onToggle={() => setPrefs((prev) => ({ ...prev, marketing: !prev.marketing }))} description="Promotional emails and announcements." />
              <ToggleRow label="SMS notifications" checked={prefs.sms} onToggle={() => setPrefs((prev) => ({ ...prev, sms: !prev.sms }))} description="Text message alerts and reminders." />
            </div>
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={savePrefs}
                disabled={saving || !user}
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save preferences'}
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('ac:open-cookie-preferences'))}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                Cookie settings
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold text-white">Data requests</h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              Use the legal request flow to delete your account, or export your data from this page.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/legal/data-request?type=delete" className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">
                Delete my account
              </Link>
              <button
                type="button"
                onClick={exportData}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                Export my data
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold text-white">Third-party connections</h2>
            <div className="mt-4 space-y-3">
              {connectedApps.map((app) => (
                <div key={app.label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">{app.label}</p>
                    <p className="text-xs text-slate-500">{app.connected ? 'Connected' : 'Not connected'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => revokeApp(app.label)}
                    className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/10"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        {status && <p className="mt-6 text-sm text-slate-300">{status}</p>}
      </section>
    </main>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onToggle,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
      <div>
        <p className="font-medium text-white">{label}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        className={`rounded-full px-3 py-1 text-xs font-semibold ${checked ? 'bg-teal-500/15 text-teal-300' : 'bg-slate-800 text-slate-400'} ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
      >
        {checked ? 'On' : 'Off'}
      </button>
    </div>
  );
}
