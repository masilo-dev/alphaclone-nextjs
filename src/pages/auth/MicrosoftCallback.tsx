'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { microsoftAuthService } from '@/services/microsoftAuthService';

export default function MicrosoftCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('Completing Microsoft 365 connection...');

  useEffect(() => {
    const run = async () => {
      if (!searchParams) {
        setMessage('Missing callback parameters.');
        return;
      }

      const code = searchParams.get('code');
      const state = searchParams.get('state') || undefined;
      const rawError = searchParams.get('error_description') || searchParams.get('error');
      const error = rawError ? decodeURIComponent(rawError.replace(/\+/g, ' ')) : null;

      if (error) {
        setMessage(error);
        return;
      }

      if (!code) {
        setMessage('Missing Microsoft authorization code.');
        return;
      }

      try {
        await microsoftAuthService.handleCallback(code, state);
        const returnPath = microsoftAuthService.getOAuthReturnPath();
        sessionStorage.removeItem('alphaclone.microsoft.oauth.return');
        setMessage('Microsoft 365 connected. Redirecting...');
        window.setTimeout(() => {
          router.replace(returnPath);
        }, 900);
      } catch (callbackError) {
        setMessage(
          callbackError instanceof Error
            ? callbackError.message
            : 'Microsoft connection failed.'
        );
      }
    };

    void run();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/5 bg-slate-900/70 p-8 text-center shadow-2xl">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-2">Microsoft 365 Callback</h1>
        <p className="text-sm text-slate-400">{message}</p>
      </div>
    </div>
  );
}
