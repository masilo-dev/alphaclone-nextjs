'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import ModuleJumpSelect from '../common/ModuleJumpSelect';
import { BonnieModulePageShell } from '../bonnie/BonnieModulePageShell';
import { WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';

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
  dataTour?: string;
  accent?: 'teal' | 'blue' | 'amber' | 'violet';
}

const ACCENT_BAR: Record<NonNullable<HubShellProps['accent']>, string> = {
  teal: 'bg-[var(--ac-accent)]',
  blue: 'bg-dashboard-blue',
  amber: 'bg-dashboard-amber',
  violet: 'bg-violet-500',
};

export default function HubShell({
  title,
  description,
  tabs,
  children,
  dataTour,
  accent = 'teal',
}: HubShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-0 ac-scroll-full ac-enterprise-module">
      <div
        className={cn(
          'flex-shrink-0 px-4 pt-3 pb-0 ac-workspace-toolbar border-b border-[var(--ws-border)]',
        )}
        {...(dataTour ? { 'data-tour': dataTour } : {})}
      >
        <div className="flex items-center gap-2">
          <span className={cn('w-1 h-4 rounded-full shrink-0', ACCENT_BAR[accent])} aria-hidden />
          <h1 className={WORKSPACE.typography.pageTitle}>{title}</h1>
        </div>
        {description ? (
          <p className="text-[12px] text-[var(--ws-text-tertiary)] mt-0.5 ml-3">{description}</p>
        ) : null}

        <ModuleJumpSelect
          options={tabs.map((t) => ({ label: t.label, href: t.href }))}
          currentHref={pathname || undefined}
          label={`Switch ${title} section`}
          onNavigate={(href) => router.push(href)}
          className="mt-3 md:hidden"
        />

        <div
          className="flex gap-0 overflow-x-auto ios-scroll mt-3 -mx-1 px-1 border-b border-[var(--ws-border)]"
          role="tablist"
          aria-label={`${title} sections`}
        >
          {tabs.map((tab) => {
            const isActive =
              pathname != null && (pathname === tab.href || pathname.startsWith(`${tab.href}?`));
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                role="tab"
                aria-selected={isActive}
                className={cn(
                  WORKSPACE.tab.base,
                  'flex-shrink-0 whitespace-nowrap',
                  isActive && WORKSPACE.tab.active,
                )}
              >
                {Icon ? <Icon className="w-3.5 h-3.5" aria-hidden /> : null}
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 ac-scroll-full px-4 py-4 md:py-5 ac-safe-bottom">
        <BonnieModulePageShell>{children}</BonnieModulePageShell>
      </div>
    </div>
  );
}
