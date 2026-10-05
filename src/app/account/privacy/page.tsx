'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type Prefs = {
  transactional: boolean;
  product_updates: boolean;
  marketing: boolean;
  sms: boolean;
  gdpr_consent: boolean;
  cookie_consent: boolean;
};

const DEFAULT_PREFS: Prefs = {
  transactional: true,
  product_updates: true,
  marketing: false,
  sms: false,
  gdpr_consent: false,
  cookie_consent: false,
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
    { label: 'Zoho', connected: false },
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
          gdpr_consent: Boolean(data.communication_prefs.gdpr_consent),
          cookie_consent: Boolean(data.communication_prefs.cookie_consent),
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
    setStatus(null);
    // Route users to the integrations marketplace where real disconnect flows live.
    const slug = label.toLowerCase();
    window.location.href = `/dashboard/marketplace?provider=${encodeURIComponent(slug)}&action=disconnect`;
  };

  if (loading) {
    return <div className="min-h-screen bg-[var(--ws-canvas)] px-6 py-20 text-[var(--ws-text-secondary)]">Loading privacy center...</div>;
  }

  return (
    <main className="min-h-screen bg-[var(--ws-canvas)] text-[var(--ws-text-secondary)]">
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="type-caption uppercase tracking-caps text-teal-400">Account Privacy</p>
          <h1 className="mt-2 text-4xl font-semibold text-white">Privacy & Consent Center</h1>
          <p className="mt-3 max-w-3xl type-card-description leading-7 text-[var(--ws-text-muted)]">
            Review what AlphaClone stores, manage your communication preferences, GDPR consent, and trigger export or deletion flows
            from one place.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-panel)]/60 p-6">
            <h2 className="text-lg font-semibold text-white">Your data summary</h2>
            <div className="mt-4 space-y-2 type-ui text-[var(--ws-text-secondary)]">
              <p>Account created: {user ? 'Available in profile data' : 'Sign in required'}</p>
              <p>Stored data: profile, CRM data, emails sent, invoices, and contracts.</p>
              <p>Email providers: Zoho, Outlook, Gmail, SendGrid, Resend, Brevo</p>
            </div>
            <div className="mt-5">
              <button
                type="button"
                onClick={exportData}
                disabled={exporting || !user}
                className="rounded-lg bg-teal-500 px-4 py-2 type-ui font-semibold text-slate-950 hover:bg-[var(--brand-blue-400)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exporting ? 'Preparing export...' : 'Export my data'}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-panel)]/60 p-6">
            <h2 className="text-lg font-semibold text-white">Communication preferences</h2>
            <div className="mt-4 space-y-3 type-ui">
              <ToggleRow label="Transactional emails" checked disabled description="Required for receipts, security alerts, and account notifications." />
              <ToggleRow label="Product updates / changelog" checked={prefs.product_updates} onToggle={() => setPrefs((prev) => ({ ...prev, product_updates: !prev.product_updates }))} description="Optional product updates and release notes." />
              <ToggleRow label="Marketing emails" checked={prefs.marketing} onToggle={() => setPrefs((prev) => ({ ...prev, marketing: !prev.marketing }))} description="Promotional emails and announcements." />
              <ToggleRow label="SMS notifications" checked={prefs.sms} onToggle={() => setPrefs((prev) => ({ ...prev, sms: !prev.sms }))} description="Text message alerts and reminders." />
              <ToggleRow label="GDPR Consent" checked={prefs.gdpr_consent} onToggle={() => setPrefs((prev) => ({ ...prev, gdpr_consent: !prev.gdpr_consent }))} description="Consent to data processing under GDPR Article 6." />
              <ToggleRow label="Cookie Consent" checked={prefs.cookie_consent} onToggle={() => setPrefs((prev) => ({ ...prev, cookie_consent: !prev.cookie_consent }))} description="Consent to non-essential cookies." />
            </div>
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={savePrefs}
                disabled={saving || !user}
                className="rounded-lg bg-white px-4 py-2 type-ui font-semibold text-slate-950 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save preferences'}
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('ac:open-cookie-preferences'))}
                className="rounded-lg border border-[var(--ws-border)] px-4 py-2 type-ui font-semibold text-[var(--ws-text-secondary)] hover:bg-[var(--ws-surface-secondary)]"
              >
                Cookie settings
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-panel)]/60 p-6">
            <h2 className="text-lg font-semibold text-white">Data requests</h2>
            <p className="mt-3 type-card-description leading-7 text-[var(--ws-text-muted)]">
              Use the legal request flow to delete your account, or export your data from this page.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/legal/data-request?type=delete" className="rounded-lg border border-[var(--ws-border)] px-4 py-2 type-ui font-semibold text-[var(--ws-text-secondary)] hover:bg-[var(--ws-surface-secondary)]">
                Delete my account
              </Link>
              <button
                type="button"
                onClick={exportData}
                className="rounded-lg border border-[var(--ws-border)] px-4 py-2 type-ui font-semibold text-[var(--ws-text-secondary)] hover:bg-[var(--ws-surface-secondary)]"
              >
                Export my data
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-panel)]/60 p-6">
            <h2 className="text-lg font-semibold text-white">Third-party connections</h2>
            <div className="mt-4 space-y-3">
              {connectedApps.map((app) => (
                <div key={app.label} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--ws-border)] bg-[var(--ws-canvas)]/40 px-4 py-3">
                  <div>
                    <p className="type-card-description font-medium text-white">{app.label}</p>
                    <p className="type-card-description text-[var(--ws-text-muted)]">{app.connected ? 'Connected' : 'Not connected'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => revokeApp(app.label)}
                    className="rounded-lg border border-rose-500/30 px-3 py-1.5 type-caption font-semibold text-[var(--error-text,var(--error-500))] hover:bg-rose-500/10"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        {status && <p className="mt-6 type-caption text-[var(--ws-text-secondary)]">{status}</p>}
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
    <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--ws-border)] bg-[var(--ws-canvas)]/40 px-4 py-3">
      <div>
        <p className="font-medium text-white">{label}</p>
        <p className="mt-1 type-card-description leading-5 text-[var(--ws-text-muted)]">{description}</p>
      </div>
      <button
        type="button"
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        className={`rounded-full px-3 py-1 type-caption font-semibold ${checked ? 'bg-teal-500/15 text-[var(--brand-blue-300)]' : 'bg-[var(--ws-surface-secondary)] text-[var(--ws-text-muted)]'} ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
      >
        {checked ? 'On' : 'Off'}
      </button>
    </div>
  );
}
