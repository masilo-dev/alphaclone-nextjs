'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import ModuleJumpSelect from '../common/ModuleJumpSelect';

export interface HubTab {
  label: string;
  href: string;
  icon?: LucideIcon;
}

interface HubShellProps {
  title: string;
  description?: string;
  tabs: HubTab[];
  children: React.ReactNode;
}

export default function HubShell({ title, description, tabs, children }: HubShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 px-4 pt-4 pb-2 border-b border-white/5 bg-slate-950/80 backdrop-blur-md sticky top-0 z-20">
        <h1 className="text-lg font-bold text-white">{title}</h1>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}

        <ModuleJumpSelect
          options={tabs.map((t) => ({ label: t.label, href: t.href }))}
          currentHref={pathname || undefined}
          label={`Switch ${title} section`}
          onNavigate={(href) => router.push(href)}
          className="mt-3"
        />

        <div className="hidden md:flex gap-2 overflow-x-auto scrollbar-hide mt-3 -mx-1 px-1 pb-1">
          {tabs.map((tab) => {
            const isActive = pathname != null && (pathname === tab.href || pathname.startsWith(`${tab.href}?`));
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-bold transition-all border ${
                  isActive
                    ? 'bg-teal-500 text-white border-teal-500 shadow-md shadow-teal-500/10'
                    : 'bg-slate-900 text-slate-400 border-white/5 hover:border-teal-500/30 hover:text-white'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-x-hidden max-md:pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:pb-safe">{children}</div>
    </div>
  );
}
