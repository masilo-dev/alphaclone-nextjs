import type { ReactNode } from 'react';
import LegalNav from '@/components/legal/LegalNav';
import AppLegalFooter from '@/components/legal/AppLegalFooter';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950">
      <LegalNav />
      {children}
      <AppLegalFooter />
    </div>
  );
}
