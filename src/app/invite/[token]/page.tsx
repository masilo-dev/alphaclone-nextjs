'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { resetPlatformState } from '@/lib/platformReset';

export default function AcceptInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { user, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const accept = async () => {
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/tenant/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Invitation could not be accepted');
      await resetPlatformState({ reason: 'tenant-switch', clearAuth: false });
      localStorage.setItem('currentTenantId', payload.tenant.id);
      window.location.assign('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invitation could not be accepted');
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-20 text-white">
      <section className="mx-auto max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
        <h1 className="text-2xl font-bold">Workspace invitation</h1>
        <p className="mt-3 text-slate-400">Accept this invitation using the same email address that received it.</p>
        {error && <p className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        {!loading && !user ? (
          <Link href={`/auth/login?next=${encodeURIComponent(`/invite/${token}`)}`} className="mt-6 inline-flex rounded-lg bg-teal-500 px-5 py-3 font-semibold text-slate-950">Sign in to accept</Link>
        ) : (
          <button onClick={accept} disabled={loading || submitting} className="mt-6 rounded-lg bg-teal-500 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">
            {submitting ? 'Accepting…' : 'Accept invitation'}
          </button>
        )}
      </section>
    </main>
  );
}

