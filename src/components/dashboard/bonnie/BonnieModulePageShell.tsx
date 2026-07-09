'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const BonnieModuleDock = dynamic(
  () => import('@/components/dashboard/bonnie/BonnieModuleDock'),
  { ssr: false, loading: () => <div className="h-full min-h-[480px] rounded-xl border border-slate-800 bg-slate-950/50" /> }
);

type BonnieModulePageShellProps = {
  children: React.ReactNode;
  className?: string;
};

/** Wraps module pages — Bonnie dock sits below main content so forms stay full width. */
export function BonnieModulePageShell({ children, className }: BonnieModulePageShellProps) {
  return (
    <div className={`flex flex-col gap-4 ${className || ''}`}>
      <div className="min-w-0 w-full">{children}</div>
      <aside className="hidden md:block w-full lg:max-w-sm lg:ml-auto shrink-0">
        <BonnieModuleDock />
      </aside>
    </div>
  );
}
