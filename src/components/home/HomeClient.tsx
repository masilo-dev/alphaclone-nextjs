'use client';

import React, { Suspense, useState, useEffect, useRef } from 'react';
import MarketingHomePage from '@/components/marketing/system/MarketingHomePage';
import dynamic from 'next/dynamic';
import { Project } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
const AppLauncher = dynamic(() => import('@/components/AppLauncher'), { ssr: false });
const SplashScreen = dynamic(() => import('@/components/ui/SplashScreen'), { ssr: false });

// Keep query-dependent behavior inside its own boundary, so reading the URL
// never makes the marketing page wait for browser JavaScript.
function HomeQueryReader({ onQuery }: { onQuery: (query: string) => void }) {
  const params = useSearchParams();
  const query = params?.toString() ?? '';
  useEffect(() => { onQuery(query); }, [query, onQuery]);
  return null;
}

interface HomeClientProps {
  initialProjects: Project[];
}

export default function HomeClient({ initialProjects }: HomeClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const { user, loading } = useAuth();
  const [projects] = useState<Project[]>(initialProjects);
  const hasRedirected = useRef(false);
  const [isPwa, setIsPwa] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(false);

  useEffect(() => {
    const mode = new URLSearchParams(query).get('mode');
    const isStandalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone);
    if (mode === 'pwa' || isStandalone) {
      setIsPwa(true);
    }

    // Remove artificial delay for instant load
    setIsInitialLoad(false);
  }, [query]);

  useEffect(() => {
    if (!loading && user && !hasRedirected.current) {
      hasRedirected.current = true;
      console.log('Authenticated user detected on homepage, redirecting to dashboard...');

      if (isPwa) {
        setIsTransitioning(true);
        setTimeout(() => {
          router.replace('/dashboard');
        }, 1200);
      } else {
        router.replace('/dashboard');
      }
    }
  }, [user, loading, router, isPwa]);

  useEffect(() => {
    const searchParams = new URLSearchParams(query);
    const authStatus = searchParams.get('auth_status');
    const message = searchParams?.get('message');

    if (authStatus === 'new_account') {
      import('react-hot-toast').then(({ default: toast }) => {
        toast((t) => (
          <div className="flex flex-col gap-2">
            <span className="font-bold text-lg">Account Created</span>
            <span>{message || 'Please sign in again to confirm your account and access the dashboard.'}</span>
            <button
              onClick={() => {
                toast.dismiss(t.id);
                const loginBtn = document.querySelector('[data-login-trigger]') as HTMLButtonElement;
                if (loginBtn) {
                  loginBtn.click();
                } else {
                  router.push('/auth/login?register=true&type=business&plan=starter');
                }
              }}
              className="bg-teal-600 text-white px-4 py-2 rounded-lg type-ui font-bold mt-2 hover:bg-teal-500 transition-colors"
            >
              Sign In Now
            </button>
          </div>
        ), {
          duration: 8000,
          position: 'top-center',
          style: {
            background: 'var(--ws-canvas)',
            color: 'var(--color-white)',
            border: '1px solid var(--brand-blue-600)',
            padding: '16px',
            maxWidth: '400px'
          }
        });
      });

      router.replace('/');
    }
  }, [query, router]);

  const handleLogin = () => {
    if (isPwa) {
      setIsTransitioning(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 1200);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <>
      <Suspense fallback={null}>
        <HomeQueryReader onQuery={setQuery} />
      </Suspense>
      {isPwa && (
        <>
          <SplashScreen isVisible={isInitialLoad} mode="loading" />
          <SplashScreen isVisible={isTransitioning} mode="opening" />
        </>
      )}

      {isPwa ? (
        <AppLauncher onLogin={handleLogin} />
      ) : (
        <MarketingHomePage />
      )}
    </>
  );
}
