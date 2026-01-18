'use client';

import React, { useState } from 'react';
import LandingPage from '@/components/LandingPage';
import { User, Project } from '@/types';

import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    router.push('/dashboard');
  };

  return (
    <main>
      <LandingPage onLogin={handleLogin} projects={projects} />
    </main>
  );
}
