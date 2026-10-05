'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import CreateBusinessOnboarding from '@/components/onboarding/CreateBusinessOnboarding';

export default function CreateBusinessOnboardingGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--ws-canvas)] text-[var(--ws-text-secondary)]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[var(--ws-canvas)] text-[var(--ws-text-primary)]">
        <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-4 py-16 sm:px-6 lg:px-8">
          <p className="type-caption uppercase tracking-caps text-teal-400">Onboarding</p>
          <h1 className="mt-3 text-4xl font-semibold text-white">Create your workspace</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--ws-text-muted)]">
            You need to be signed in before you can create a new business workspace. Once you are in, this page will walk you through business details and plan selection.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/auth/login?register=true&type=business&plan=starter" className="rounded-lg bg-teal-500 px-4 py-2 type-ui font-semibold text-slate-950 hover:bg-[var(--brand-blue-400)]">
              Sign up
            </Link>
            <Link href="/auth/login" className="rounded-lg border border-[var(--ws-border)] bg-[var(--ws-panel)] px-4 py-2 type-ui font-semibold text-[var(--ws-text-secondary)] hover:bg-[var(--ws-surface-secondary)]">
              Sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <CreateBusinessOnboarding />;
}
