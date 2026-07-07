'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import ModuleJumpSelect from '../common/ModuleJumpSelect';
import { ENTERPRISE } from '@/constants/design';
import { cn } from '@/lib/utils';

export interface HubTab {
  label: string;
  href: string;
  icon?: LucideIcon;
}

type HubAccent = 'teal' | 'blue' | 'purple' | 'emerald' | 'amber' | 'rose' | 'sky' | 'orange';

const ACCENT_STYLES: Record<HubAccent, {
  titleAccent: string;
  pillBg: string;
  pillText: string;
  pillBorder: string;
  activeTab: string;
  inactiveTab: string;
  glow: string;
}> = {
  teal: {
    titleAccent: 'text-[#adebb3]',
    pillBg: 'bg-[#adebb3]/10',
    pillText: 'text-[#adebb3]',
    pillBorder: 'border-[#adebb3]/20',
    activeTab: 'bg-[#adebb3] text-slate-950 border-[#adebb3] shadow-[0_10px_30px_-12px_rgba(173,235,179,0.55)]',
    inactiveTab: 'bg-slate-900 text-slate-400 border-white/5 hover:border-[#adebb3]/30 hover:text-white',
    glow: 'bg-[radial-gradient(circle_at_top_right,rgba(173,235,179,0.18),transparent_42%)]',
  },
  blue: {
    titleAccent: 'text-[#60a5fa]',
    pillBg: 'bg-[#60a5fa]/10',
    pillText: 'text-[#60a5fa]',
    pillBorder: 'border-[#60a5fa]/20',
    activeTab: 'bg-[#60a5fa] text-slate-950 border-[#60a5fa] shadow-[0_10px_30px_-12px_rgba(96,165,250,0.55)]',
    inactiveTab: 'bg-slate-900 text-slate-400 border-white/5 hover:border-[#60a5fa]/30 hover:text-white',
    glow: 'bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.18),transparent_42%)]',
  },
  purple: {
    titleAccent: 'text-[#c084fc]',
    pillBg: 'bg-[#c084fc]/10',
    pillText: 'text-[#c084fc]',
    pillBorder: 'border-[#c084fc]/20',
    activeTab: 'bg-[#c084fc] text-slate-950 border-[#c084fc] shadow-[0_10px_30px_-12px_rgba(192,132,252,0.55)]',
    inactiveTab: 'bg-slate-900 text-slate-400 border-white/5 hover:border-[#c084fc]/30 hover:text-white',
    glow: 'bg-[radial-gradient(circle_at_top_right,rgba(192,132,252,0.18),transparent_42%)]',
  },
  emerald: {
    titleAccent: 'text-[#4ade80]',
    pillBg: 'bg-[#4ade80]/10',
    pillText: 'text-[#4ade80]',
    pillBorder: 'border-[#4ade80]/20',
    activeTab: 'bg-[#4ade80] text-slate-950 border-[#4ade80] shadow-[0_10px_30px_-12px_rgba(74,222,128,0.55)]',
    inactiveTab: 'bg-slate-900 text-slate-400 border-white/5 hover:border-[#4ade80]/30 hover:text-white',
    glow: 'bg-[radial-gradient(circle_at_top_right,rgba(74,222,128,0.18),transparent_42%)]',
  },
  amber: {
    titleAccent: 'text-[#facc15]',
    pillBg: 'bg-[#facc15]/10',
    pillText: 'text-[#facc15]',
    pillBorder: 'border-[#facc15]/20',
    activeTab: 'bg-[#facc15] text-slate-950 border-[#facc15] shadow-[0_10px_30px_-12px_rgba(250,204,21,0.55)]',
    inactiveTab: 'bg-slate-900 text-slate-400 border-white/5 hover:border-[#facc15]/30 hover:text-white',
    glow: 'bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.18),transparent_42%)]',
  },
  rose: {
    titleAccent: 'text-[#f87171]',
    pillBg: 'bg-[#f87171]/10',
    pillText: 'text-[#f87171]',
    pillBorder: 'border-[#f87171]/20',
    activeTab: 'bg-[#f87171] text-slate-950 border-[#f87171] shadow-[0_10px_30px_-12px_rgba(248,113,113,0.55)]',
    inactiveTab: 'bg-slate-900 text-slate-400 border-white/5 hover:border-[#f87171]/30 hover:text-white',
    glow: 'bg-[radial-gradient(circle_at_top_right,rgba(248,113,113,0.18),transparent_42%)]',
  },
  sky: {
    titleAccent: 'text-[#38bdf8]',
    pillBg: 'bg-[#38bdf8]/10',
    pillText: 'text-[#38bdf8]',
    pillBorder: 'border-[#38bdf8]/20',
    activeTab: 'bg-[#38bdf8] text-slate-950 border-[#38bdf8] shadow-[0_10px_30px_-12px_rgba(56,189,248,0.55)]',
    inactiveTab: 'bg-slate-900 text-slate-400 border-white/5 hover:border-[#38bdf8]/30 hover:text-white',
    glow: 'bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_42%)]',
  },
  orange: {
    titleAccent: 'text-[#fb923c]',
    pillBg: 'bg-[#fb923c]/10',
    pillText: 'text-[#fb923c]',
    pillBorder: 'border-[#fb923c]/20',
    activeTab: 'bg-[#fb923c] text-slate-950 border-[#fb923c] shadow-[0_10px_30px_-12px_rgba(251,146,60,0.55)]',
    inactiveTab: 'bg-slate-900 text-slate-400 border-white/5 hover:border-[#fb923c]/30 hover:text-white',
    glow: 'bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.18),transparent_42%)]',
  },
};

interface HubShellProps {
  title: string;
  description?: string;
  tabs: HubTab[];
  children: React.ReactNode;
  dataTour?: string;
  accent?: HubAccent;
}

export default function HubShell({ title, description, tabs, children, dataTour, accent = 'teal' }: HubShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const accentStyles = ACCENT_STYLES[accent];

  return (
    <div className="flex flex-col min-h-0 ac-scroll-full ac-enterprise-module">
      <div
        className={cn('relative flex-shrink-0 px-4 pt-4 pb-2 overflow-hidden', ENTERPRISE.moduleLayout.stickyHeader)}
        {...(dataTour ? { 'data-tour': dataTour } : {})}
      >
        <div className={cn('absolute inset-0 pointer-events-none', accentStyles.glow)} />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className={cn('hidden sm:inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.28em]', accentStyles.pillBg, accentStyles.pillText, accentStyles.pillBorder)}>
              {title}
            </div>
            <h1 className="text-2xl md:text-[32px] font-bold text-white tracking-tight">{title}</h1>
          </div>
          {description && <p className="text-sm text-slate-400 mt-1 max-w-2xl">{description}</p>}
        </div>

        <ModuleJumpSelect
          options={tabs.map((t) => ({ label: t.label, href: t.href }))}
          currentHref={pathname || undefined}
          label={`Switch ${title} section`}
          onNavigate={(href) => router.push(href)}
          className="relative mt-3"
        />

        <div className="flex gap-2 overflow-x-auto ios-scroll mt-3 -mx-1 px-1 pb-1 md:flex-wrap md:overflow-visible">
          {tabs.map((tab) => {
            const isActive = pathname != null && (pathname === tab.href || pathname.startsWith(`${tab.href}?`));
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex-shrink-0 inline-flex items-center gap-1.5 min-h-11 px-3.5 rounded-full text-xs font-bold transition-all border',
                  isActive ? accentStyles.activeTab : accentStyles.inactiveTab
                )}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="flex-1 min-h-0 ac-scroll-full max-md:pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-safe">
        {children}
      </div>
    </div>
  );
}
