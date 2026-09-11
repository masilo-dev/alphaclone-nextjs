'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { usePWA } from '@/contexts/PWAContext';
import Splash from '@/components/pwa/Splash';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, needsMfa } = useAuth();
  const { appSurface } = usePWA();
  const router = useRouter();
  const pathname = usePathname();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    const handleRedirection = async () => {
      if (!user) {
        const isAuthCallback = typeof window !== 'undefined' && (
          window.location.search.includes('code=') ||
          window.location.pathname.includes('/auth/callback') ||
          sessionStorage.getItem('auth_callback_in_progress') === 'true'
        );

        if (pathname && pathname !== '/auth/login' && !pathname.startsWith('/auth/') && !isAuthCallback) {
          setIsRedirecting(true);
          await router.replace('/auth/login');
        } else {
          setIsRedirecting(false);
        }
        return;
      }

      if (needsMfa && pathname && pathname !== '/auth/login' && !pathname.startsWith('/auth/')) {
        setIsRedirecting(true);
        await router.replace('/auth/login?reason=mfa_required');
        return;
      }

      if ((pathname === '/' || pathname === '/auth/login') && !needsMfa) {
        setIsRedirecting(true);
        await router.replace('/dashboard');
      } else {
        setIsRedirecting(false);
      }
    };

    void handleRedirection();
  }, [user, authLoading, needsMfa, pathname, router]);

  if (authLoading || isRedirecting) return <Splash />;

  const isCompanion = appSurface === 'pwa-mobile' || appSurface === 'pwa-tablet';

  return (
    <div
      className={`fixed inset-0 flex h-[100dvh] w-screen flex-col overflow-hidden overscroll-none bg-[var(--background-app)] text-[var(--text-primary)] ${isCompanion ? 'ac-companion-shell' : 'ac-installed-desktop-shell'}`}
      data-companion={isCompanion ? 'true' : 'false'}
    >
      <div
        className="app-viewport ios-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
        style={{
          paddingTop: isCompanion ? 'env(safe-area-inset-top, 0px)' : undefined,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {children}
      </div>
    </div>
  );
}
