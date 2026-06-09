'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import CreateBusinessOnboarding from '@/components/onboarding/CreateBusinessOnboarding';

export default function CreateBusinessOnboardingGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-xs uppercase tracking-[0.2em] text-teal-400">Onboarding</p>
          <h1 className="mt-3 text-4xl font-semibold text-white">Create your workspace</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
            You need to be signed in before you can create a new business workspace. Once you are in, this page will walk you through business details and plan selection.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/auth/login?register=true&type=business&plan=starter" className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400">
              Sign up
            </Link>
            <Link href="/auth/login" className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">
              Sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <CreateBusinessOnboarding />;
}
