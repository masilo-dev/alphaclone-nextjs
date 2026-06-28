'use client';

import type { ReactNode } from 'react';
import PublicNavigation from '@/components/PublicNavigation';
import LegalNav from '@/components/legal/LegalNav';
import AppLegalFooter from '@/components/legal/AppLegalFooter';

export default function LegalMarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950">
      <PublicNavigation onLoginClick={() => {}} />
      <div className="pt-20 flex min-h-[calc(100vh-5rem)] flex-col">
        <LegalNav />
        <div className="flex-1">{children}</div>
        <AppLegalFooter />
      </div>
    </div>
  );
}
