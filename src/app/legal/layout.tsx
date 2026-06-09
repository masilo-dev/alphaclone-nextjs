import type { ReactNode } from 'react';
import LegalNav from '@/components/legal/LegalNav';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950">
      <LegalNav />
      {children}
      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-6 text-xs text-slate-500 sm:px-6 lg:px-8">
          © 2025 AlphaClone Systems LLC. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
