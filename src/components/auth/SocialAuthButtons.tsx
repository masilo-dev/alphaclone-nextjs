'use client';

import React from 'react';

type SocialAuthButtonsProps = {
  isLoading?: boolean;
  disabled?: boolean;
  /** Preserve OAuth return path (e.g. /authorize?...) through Google/LinkedIn/Facebook. */
  nextPath?: string | null;
  onError: (message: string) => void;
  onLoadingChange?: (loading: boolean) => void;
  className?: string;
};

export default function SocialAuthButtons({
  isLoading = false,
  disabled = false,
  nextPath,
  onError,
  onLoadingChange,
  className = '',
}: SocialAuthButtonsProps) {
  const runOAuth = async (provider: 'google' | 'linkedin' | 'facebook') => {
    onLoadingChange?.(true);
    onError('');
    try {
      const { authService } = await import('@/services/authService');
      const path = nextPath || undefined;
      const result =
        provider === 'google'
          ? await authService.signInWithGoogle(path)
          : provider === 'linkedin'
            ? await authService.signInWithLinkedIn(path)
            : await authService.signInWithFacebook(path);
      if (result.error) {
        onError(result.error);
        onLoadingChange?.(false);
      }
    } catch {
      onError(`Failed to initialize ${provider} sign-in`);
      onLoadingChange?.(false);
    }
  };

  const btnClass =
    'h-10 flex-1 min-w-0 flex items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className={className}>
      <p className="text-[11px] text-center text-slate-400 mb-2">
        Workspace created automatically — no form required
      </p>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          aria-label="Continue with Google"
          title="Continue with Google"
          onClick={() => runOAuth('google')}
          disabled={isLoading || disabled}
          className={`${btnClass} bg-white hover:bg-gray-50 text-gray-700 border-gray-300`}
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          <span className="truncate">Google</span>
        </button>

        <button
          type="button"
          aria-label="Continue with LinkedIn"
          title="Continue with LinkedIn"
          onClick={() => runOAuth('linkedin')}
          disabled={isLoading || disabled}
          className={`${btnClass} bg-[#0A66C2] hover:bg-[#0958A8] text-white border-[#0A66C2]`}
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.03-1.84-3.03-1.85 0-2.13 1.45-2.13 2.94v5.66H9.36V9h3.42v1.56h.05c.48-.9 1.64-1.84 3.37-1.84 3.6 0 4.26 2.37 4.26 5.46v6.27zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
          </svg>
          <span className="truncate">LinkedIn</span>
        </button>

        <button
          type="button"
          aria-label="Continue with Facebook"
          title="Continue with Facebook"
          onClick={() => runOAuth('facebook')}
          disabled={isLoading || disabled}
          className={`${btnClass} bg-[#1877F2] hover:bg-[#166FE5] text-white border-[#1877F2]`}
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.79-4.7 4.54-4.7 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.5 0-1.96.93-1.96 1.89v2.26h3.34l-.53 3.49h-2.81V24C19.61 23.09 24 18.1 24 12.07z" />
          </svg>
          <span className="truncate">Facebook</span>
        </button>
      </div>
    </div>
  );
}
