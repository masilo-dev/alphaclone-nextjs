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
