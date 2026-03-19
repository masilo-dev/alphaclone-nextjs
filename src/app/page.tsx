'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import LandingPage from '@/components/LandingPage';
import AppLauncher from '@/components/AppLauncher';
import { Project } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';

import SplashScreen from '@/components/ui/SplashScreen';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const hasRedirected = useRef(false);
  const [isPwa, setIsPwa] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    const mode = searchParams.get('mode');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (mode === 'pwa' || isStandalone) {
      setIsPwa(true);
    }

    const timer = setTimeout(() => setIsInitialLoad(false), 2000);
    return () => clearTimeout(timer);
  }, [searchParams]);

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
    const authStatus = searchParams.get('auth_status');
    const message = searchParams.get('message');

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
                  router.push('/register');
                }
              }}
              className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-bold mt-2 hover:bg-teal-500 transition-colors"
            >
              Sign In Now
            </button>
          </div>
        ), {
          duration: 8000,
          position: 'top-center',
          style: {
            background: '#0f172a',
            color: '#fff',
            border: '1px solid #0d9488',
            padding: '16px',
            maxWidth: '400px'
          }
        });
      });

      router.replace('/');
    }
  }, [searchParams, router]);

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
    <main>
      <SplashScreen isVisible={isInitialLoad && isPwa} mode="loading" />
      <SplashScreen isVisible={isTransitioning} mode="opening" />

      {isPwa ? (
        <AppLauncher onLogin={handleLogin} />
      ) : (
        <LandingPage onLogin={handleLogin} projects={projects} />
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#020D1A]" />}>
      <HomeContent />
    </Suspense>
  );
}
