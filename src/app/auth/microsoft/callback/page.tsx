import { Suspense } from 'react';
import MicrosoftCallback from '@/pages/auth/MicrosoftCallback';

export default function MicrosoftCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <p className="text-slate-400">Loading Microsoft integration...</p>
      </div>
    }>
      <MicrosoftCallback />
    </Suspense>
  );
}

