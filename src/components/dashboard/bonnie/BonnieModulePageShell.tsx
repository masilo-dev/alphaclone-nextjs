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

/** Wraps module pages without ModulePageLayout — adds Bonnie dock on xl+ */
export function BonnieModulePageShell({ children, className }: BonnieModulePageShellProps) {
  return (
    <div className={`flex flex-col gap-4 xl:flex-row xl:items-start ${className || ''}`}>
      <div className="min-w-0 flex-1">{children}</div>
      <aside className="hidden w-[288px] 2xl:w-[340px] shrink-0 xl:block xl:sticky xl:top-6 xl:h-[calc(100vh-6rem)]">
        <div className="h-full rounded-3xl border border-white/5 bg-slate-900/50 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/20">
          <BonnieModuleDock />
        </div>
      </aside>
    </div>
  );
}
