'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { EMAIL_PREFERENCE_CATEGORIES } from '@/lib/email/emailPurposeRegistry';

type PublicPreferences = {
  marketing: boolean;
  outreach: boolean;
  newsletter: boolean;
  categories: Record<string, boolean>;
};

export default function EmailPreferencesPage() {
  const params = useSearchParams();
  const tenant = params.get('tenant') || '';
  const email = params.get('email') || '';
  const token = params.get('token') || '';

  const [prefs, setPrefs] = useState<PublicPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tenant || !email) {
      setError('This preferences link is incomplete.');
      setLoading(false);
      return;
    }
    const qs = new URLSearchParams({ tenant, email, ...(token ? { token } : {}) });
    fetch(`/api/email/preferences?${qs}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setPrefs(data.preferences);
      })
      .catch((err) => setError(err.message || 'Unable to load preferences'))
      .finally(() => setLoading(false));
  }, [tenant, email, token]);

  async function save(next: Partial<PublicPreferences & { unsubscribe_all_marketing?: boolean }>) {
    if (!token) {
      setError('Sign in or use the link from your email to save preferences.');
      return;
    }
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/email/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenant, email, token, ...next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setPrefs(data.preferences);
      setMessage('Preferences saved.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function toggleCategory(key: string) {
    if (!prefs) return;
    setPrefs({
      ...prefs,
      categories: { ...prefs.categories, [key]: !prefs.categories[key] },
    });
  }

  if (loading) {
    return <main className="min-h-screen bg-[#060d1a] text-white flex items-center justify-center">Loading…</main>;
  }

  return (
    <main className="min-h-screen bg-[#060d1a] text-white px-4 py-12">
      <div className="max-w-xl mx-auto">
        <header className="mb-8">
          <p className="text-cyan-400 text-sm font-semibold tracking-wide uppercase">AlphaClone Systems</p>
          <h1 className="text-3xl font-bold mt-2">Email Preferences</h1>
          {email && <p className="text-slate-400 mt-2 text-sm">{email}</p>}
        </header>

        {error && <p className="mb-4 text-red-400 text-sm">{error}</p>}
        {message && <p className="mb-4 text-emerald-400 text-sm">{message}</p>}

        {prefs && (
          <div className="space-y-6">
            <section className="rounded-xl border border-cyan-900/40 bg-[#0f172a] p-6">
              <h2 className="font-semibold text-lg mb-4">Marketing</h2>
              <label className="flex items-center justify-between py-2 border-b border-slate-800">
                <span className="text-slate-300">Product updates & tips</span>
                <input type="checkbox" checked={prefs.marketing} onChange={() => setPrefs({ ...prefs, marketing: !prefs.marketing })} />
              </label>
              <label className="flex items-center justify-between py-2 border-b border-slate-800">
                <span className="text-slate-300">Outreach from this sender</span>
                <input type="checkbox" checked={prefs.outreach} onChange={() => setPrefs({ ...prefs, outreach: !prefs.outreach })} />
              </label>
              <label className="flex items-center justify-between py-2">
                <span className="text-slate-300">Newsletter</span>
                <input type="checkbox" checked={prefs.newsletter} onChange={() => setPrefs({ ...prefs, newsletter: !prefs.newsletter })} />
              </label>
            </section>

            <section className="rounded-xl border border-cyan-900/40 bg-[#0f172a] p-6">
              <h2 className="font-semibold text-lg mb-4">Business Notifications</h2>
              {EMAIL_PREFERENCE_CATEGORIES.filter((c) =>
                !['marketing', 'retention', 'platform_announcements'].includes(c.key),
              ).map((cat) => (
                <label key={cat.key} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                  <span>
                    <span className="text-slate-200 block">{cat.label}</span>
                    <span className="text-slate-500 text-xs">{cat.description}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={prefs.categories[cat.key] !== false}
                    onChange={() => toggleCategory(cat.key)}
                  />
                </label>
              ))}
            </section>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                disabled={saving || !token}
                onClick={() => save({ ...prefs })}
                className="w-full py-3 rounded-lg bg-cyan-500 text-[#060d1a] font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Preferences'}
              </button>
              <button
                type="button"
                disabled={saving || !token}
                onClick={() => save({ unsubscribe_all_marketing: true })}
                className="w-full py-3 rounded-lg border border-slate-600 text-slate-300 disabled:opacity-50"
              >
                Unsubscribe from all optional emails
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Account security, verification, and legally required transactional messages may still be delivered when necessary.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
