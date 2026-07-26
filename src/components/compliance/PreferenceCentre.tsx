'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type Preferences = {
  marketing: boolean; newsletter: boolean; productAnnouncements: boolean; eventInvitations: boolean;
  salesFollowUp: boolean; researchRequests: boolean; optionalServiceUpdates: boolean;
  preferredLanguage: string; preferredFrequency: string;
};
const initial: Preferences = {
  marketing: false, newsletter: false, productAnnouncements: false, eventInvitations: false,
  salesFollowUp: false, researchRequests: false, optionalServiceUpdates: true,
  preferredLanguage: '', preferredFrequency: 'immediate',
};

export function PreferenceCentre() {
  const token = useSearchParams().get('token') || '';
  const [email, setEmail] = useState('');
  const [values, setValues] = useState(initial);
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error'>('loading');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!token) { setError('This preference link is missing or invalid.'); setState('error'); return; }
    fetch(`/api/privacy/preferences?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Unable to load preferences.');
        setEmail(body.email); setValues(body.preferences); setState('ready');
      }).catch((reason) => { setError(reason.message); setState('error'); });
  }, [token]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setState('saving'); setError('');
    try {
      const response = await fetch('/api/privacy/preferences', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, ...values }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to save preferences.');
      setValues(body.preferences); setState('saved');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save preferences.'); setState('error'); }
  };
  const optional = [
    ['marketing', 'Marketing email'], ['newsletter', 'Newsletters'], ['productAnnouncements', 'Product announcements'],
    ['eventInvitations', 'Event invitations'], ['salesFollowUp', 'Sales follow-up'],
    ['researchRequests', 'Research requests'], ['optionalServiceUpdates', 'Optional service updates'],
  ] as const;
  return <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100">
    <form onSubmit={submit} className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-6 sm:p-8">
      <p className="text-sm font-medium text-teal-300">Communication preferences</p>
      <h1 className="mt-1 text-3xl font-semibold">Choose what you receive</h1>
      <p className="mt-2 text-slate-400">{email || 'Secure preference centre'}</p>
      <section className="mt-7 border-t border-white/10 pt-6">
        <h2 className="font-semibold">Required service messages</h2>
        <p className="mt-1 text-sm text-slate-400">Security, authentication, billing, and essential service notices cannot be disabled here.</p>
      </section>
      <fieldset className="mt-6 space-y-3" disabled={state === 'loading' || state === 'saving' || state === 'error'}>
        <legend className="mb-3 font-semibold">Optional messages</legend>
        {optional.map(([key, label]) => <label key={key} className="flex min-h-11 items-center justify-between rounded-xl border border-white/10 p-3">
          <span>{label}</span><input className="h-5 w-5 accent-teal-400" type="checkbox" checked={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.checked })} />
        </label>)}
      </fieldset>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Preferred language<input value={values.preferredLanguage} onChange={(event) => setValues({ ...values, preferredLanguage: event.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 p-3" placeholder="e.g. en, pl, de" /></label>
        <label className="text-sm">Frequency<select value={values.preferredFrequency} onChange={(event) => setValues({ ...values, preferredFrequency: event.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 p-3"><option value="immediate">As sent</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
      </div>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
      {state === 'saved' && <p role="status" className="mt-5 rounded-xl bg-teal-400/10 p-3 text-sm text-teal-200">Your preferences have been saved.</p>}
      <button disabled={state === 'loading' || state === 'saving' || state === 'error'} className="mt-6 min-h-11 rounded-xl bg-teal-400 px-5 py-2 font-semibold text-slate-950 disabled:opacity-50">Save preferences</button>
    </form>
  </main>;
}
