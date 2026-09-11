import { Suspense } from 'react';
import AuthCodeErrorClient from './AuthCodeErrorClient';

export const dynamic = 'force-dynamic';

function AuthCodeErrorFallback() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-8 h-8 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
    </div>
  );
}

export default function AuthCodeErrorPage() {
  return (
    <Suspense fallback={<AuthCodeErrorFallback />}>
      <AuthCodeErrorClient />
    </Suspense>
  );
}
