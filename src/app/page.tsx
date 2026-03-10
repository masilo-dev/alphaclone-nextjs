'use client';

import React, { useState, useEffect, useRef } from 'react';
import LandingPage from '@/components/LandingPage';
import { User, Project } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const hasRedirected = useRef(false);

  // Auto-redirect authenticated users to dashboard (once auth state is settled)
  useEffect(() => {
    if (!loading && user && !hasRedirected.current) {
      hasRedirected.current = true;
      console.log('Authenticated user detected on homepage, redirecting to dashboard...');
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  // Handle new account notification
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authStatus = params.get('auth_status');
    const message = params.get('message');

    if (authStatus === 'new_account') {
      import('react-hot-toast').then(({ default: toast }) => {
        toast((t) => (
          <div className="flex flex-col gap-2">
            <span className="font-bold text-lg">Account Created! 🎉</span>
            <span>{message || 'Please sign in again to confirm your account and access the dashboard.'}</span>
            <button 
              onClick={() => {
                toast.dismiss(t.id);
                const loginBtn = document.querySelector('[data-login-trigger]') as HTMLButtonElement;
                if (loginBtn) loginBtn.click();
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
      
      // Clean up URL
      router.replace('/');
    }
  }, [router]);

  const handleLogin = () => {
    // Redirect is now handled by useEffect above
    router.push('/dashboard');
  };

  return (
    <main>
      <LandingPage onLogin={handleLogin} projects={projects} />
    </main>
  );
}
