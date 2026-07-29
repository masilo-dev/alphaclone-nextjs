'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export function PrivacyRequestStatus() {
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') || '';
  const [record, setRecord] = useState<Record<string, string | null> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!token) { setError('This status link is missing.'); return; }
    fetch(`/api/privacy/requests?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setRecord(body.request); })
      .catch((reason) => setError(reason.message || 'Unable to load request.'));
  }, [token]);
  return <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100"><section className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-slate-900 p-8"><p className="text-sm text-teal-300">Privacy request status</p>{error ? <p role="alert" className="mt-4 text-red-200">{error}</p> : !record ? <p className="mt-4 text-slate-400">Loading…</p> : <><h1 className="mt-2 text-3xl font-semibold">{record.request_number}</h1><dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-5 gap-y-3"><dt className="text-slate-400">Request</dt><dd>{String(record.request_type).replaceAll('_', ' ')}</dd><dt className="text-slate-400">Status</dt><dd>{String(record.status).replaceAll('_', ' ')}</dd><dt className="text-slate-400">Identity</dt><dd>{String(record.identity_status).replaceAll('_', ' ')}</dd><dt className="text-slate-400">Received</dt><dd>{new Date(String(record.created_at)).toLocaleDateString()}</dd></dl></>}</section></main>;
}
