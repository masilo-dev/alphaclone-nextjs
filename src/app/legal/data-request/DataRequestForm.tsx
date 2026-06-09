'use client';

import { useState, type FormEvent } from 'react';

export default function DataRequestForm() {
  const [email, setEmail] = useState('');
  const [requestType, setRequestType] = useState('Access My Data');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch('/api/legal/data-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, requestType, details }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Request failed');
      }
      setStatus('Request submitted. We process all requests within 30 days.');
      setEmail('');
      setDetails('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200">Email address</label>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-teal-500"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200">Request type</label>
        <select
          value={requestType}
          onChange={(event) => setRequestType(event.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-teal-500"
        >
          <option>Access My Data</option>
          <option>Correct My Data</option>
          <option>Export My Data</option>
          <option>Delete My Account & Data</option>
        </select>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200">Additional details</label>
        <textarea
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          rows={5}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-teal-500"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Submitting...' : 'Submit request'}
      </button>
      {status && <p className="text-sm text-slate-300">{status}</p>}
    </form>
  );
}
