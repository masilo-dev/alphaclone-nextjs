'use client';

import { FormEvent, useState } from 'react';

export function PrivacyRequestCentre() {
  const [result, setResult] = useState<{ requestNumber: string; statusToken: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/privacy/requests', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to submit request.');
      setResult(body);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to submit request.'); }
    finally { setBusy(false); }
  };
  if (result) return <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100"><section className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-slate-900 p-8"><p className="text-teal-300">Request received</p><h1 className="mt-2 text-3xl font-semibold">{result.requestNumber}</h1><p className="mt-3 text-slate-300">Keep this reference. Your identity must be verified before personal data is disclosed or changed.</p><a className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-teal-400 px-5 font-semibold text-slate-950" href={`/privacy/request/status?token=${encodeURIComponent(result.statusToken)}`}>View request status</a></section></main>;
  return <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100"><form onSubmit={submit} className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-6 sm:p-8">
    <p className="text-sm font-medium text-teal-300">Privacy request centre</p><h1 className="mt-1 text-3xl font-semibold">Make a privacy request</h1>
    <p className="mt-2 text-slate-400">Submitting a request does not guarantee deletion where legal retention obligations apply.</p>
    <div className="mt-7 grid gap-5">
      <label>Organisation reference<input required name="tenantId" className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 p-3" aria-describedby="tenant-help" /></label>
      <p id="tenant-help" className="-mt-4 text-xs text-slate-400">Use the organisation ID shown in the privacy notice or communication you received.</p>
      <label>Request type<select required name="requestType" className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 p-3"><option value="access">Access my data</option><option value="correction">Correct my data</option><option value="deletion">Delete my data</option><option value="portability">Export my data</option><option value="restriction">Restrict processing</option><option value="objection">Object to processing</option><option value="consent_withdrawal">Withdraw consent</option><option value="marketing_opt_out">Marketing opt-out</option><option value="do_not_sell_or_share">Do not sell or share</option><option value="complaint">Complaint</option></select></label>
      <label>Email<input required type="email" name="email" autoComplete="email" className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 p-3" /></label>
      <label>Name<input name="name" autoComplete="name" className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 p-3" /></label>
      <label>Country or jurisdiction<input name="jurisdiction" autoComplete="country-name" className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 p-3" /></label>
      <label>Request details<textarea required minLength={10} maxLength={5000} name="details" rows={6} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 p-3" /></label>
    </div>
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-400/10 p-3 text-red-200">{error}</p>}
    <button disabled={busy} className="mt-6 min-h-11 rounded-xl bg-teal-400 px-5 font-semibold text-slate-950 disabled:opacity-50">{busy ? 'Submitting…' : 'Submit request'}</button>
  </form></main>;
}
