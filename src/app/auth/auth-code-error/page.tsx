'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';

export default function AuthCodeErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams?.get('error') || 'sign_in_failed';

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-white">Sign-in could not be completed</h1>
        <p className="text-sm text-slate-400">
          {error === 'linkedin_sync_failed'
            ? 'Your account signed in, but LinkedIn could not be connected. You can retry from Settings → Integrations.'
            : 'The authorization code was invalid or expired. Please try signing in again.'}
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Link
            href="/auth/login"
            className="py-3 px-4 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl transition-colors"
          >
            Back to login
          </Link>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-300">
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
