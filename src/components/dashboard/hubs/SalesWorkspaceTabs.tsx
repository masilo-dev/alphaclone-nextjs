'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutGrid,
  Workflow,
  TrendingUp,
  Users,
  Contact,
  Target,
  MessageCircle,
  FileText,
  Search,
  CheckSquare,
  Bell,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SalesWorkspaceTab {
  label: string;
  shortLabel?: string;
  href: string;
  icon: LucideIcon;
}

/** Primary destinations — keep ≤6 for mobile scannability */
export const SALES_PRIMARY_TABS: SalesWorkspaceTab[] = [
  { label: 'Overview', shortLabel: 'Home', href: '/dashboard/crm', icon: LayoutGrid },
  { label: 'Leads', href: '/dashboard/leads', icon: TrendingUp },
  { label: 'Contacts', href: '/dashboard/contacts', icon: Contact },
  { label: 'Companies', href: '/dashboard/crm/accounts', icon: Users },
  { label: 'Deals', href: '/dashboard/deals', icon: Target },
  { label: 'Follow-ups', href: '/dashboard/crm/follow-ups', icon: Bell },
];

/** Secondary tools — accessible via More menu */
export const SALES_SECONDARY_TABS: SalesWorkspaceTab[] = [
  { label: 'Workspace', href: '/dashboard/crm/workspace', icon: Workflow },
  { label: 'Console', href: '/dashboard/crm/console', icon: MessageCircle },
  { label: 'Reports', href: '/dashboard/crm/reports', icon: FileText },
  { label: 'Lead Finder', shortLabel: 'Finder', href: '/dashboard/leads/finder', icon: Search },
  { label: 'Tasks', href: '/dashboard/tasks', icon: CheckSquare },
];

/** @deprecated Prefer SALES_PRIMARY_TABS + SALES_SECONDARY_TABS */
export const SALES_WORKSPACE_TABS: SalesWorkspaceTab[] = [
  ...SALES_PRIMARY_TABS,
  ...SALES_SECONDARY_TABS,
];

function isContactsRoute(pathname: string): boolean {
  return (
    pathname === '/dashboard/contacts' ||
    pathname === '/dashboard/business/clients' ||
    pathname === '/dashboard/clients' ||
    pathname === '/dashboard/crm/unified-contacts'
  );
}

export function isSalesWorkspaceTabActive(pathname: string, href: string): boolean {
  if (href === '/dashboard/contacts') return isContactsRoute(pathname);
  if (href === '/dashboard/crm/workspace') return pathname === '/dashboard/crm/workspace';
  if (href === '/dashboard/crm/accounts') {
    return pathname === '/dashboard/crm/accounts' || pathname.startsWith('/dashboard/crm/accounts/');
  }
  return pathname === href || pathname.startsWith(`${href}?`);
}

interface SalesWorkspaceTabsProps {
  pathname: string;
  compact?: boolean;
  className?: string;
}

function TabLink({
  tab,
  pathname,
  compact,
}: {
  tab: SalesWorkspaceTab;
  pathname: string;
  compact: boolean;
}) {
  const isActive = isSalesWorkspaceTabActive(pathname, tab.href);
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 shrink-0 rounded-lg border px-2.5 min-h-11 text-[12px] font-semibold transition-colors',
        compact ? 'py-1' : 'py-1.5',
        isActive
          ? 'border-teal-500/40 bg-teal-500/10 text-teal-300'
          : 'border-transparent bg-white/[0.03] text-slate-400 hover:text-slate-200 hover:border-white/10'
      )}
    >
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      <span>{compact && tab.shortLabel ? tab.shortLabel : tab.label}</span>
    </Link>
  );
}

export function SalesWorkspaceTabs({ pathname, compact = false, className }: SalesWorkspaceTabsProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const secondaryActive = useMemo(
    () => SALES_SECONDARY_TABS.some((t) => isSalesWorkspaceTabActive(pathname, t.href)),
    [pathname]
  );

  return (
    <div
      className={cn(
        'flex gap-2 overflow-x-auto ios-scroll -mx-1 px-1 pb-1 md:flex-wrap md:overflow-visible items-center',
        compact ? 'py-0.5' : 'mt-3',
        className
      )}
      role="navigation"
      aria-label="Sales workspace"
    >
      {SALES_PRIMARY_TABS.map((tab) => (
        <TabLink key={tab.href} tab={tab} pathname={pathname} compact={compact} />
      ))}

      <div className="relative shrink-0">
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-haspopup="menu"
          onClick={() => setMoreOpen((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 min-h-11 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition-colors',
            secondaryActive || moreOpen
              ? 'border-teal-500/40 bg-teal-500/10 text-teal-300'
              : 'border-transparent bg-white/[0.03] text-slate-400 hover:text-slate-200'
          )}
        >
          <MoreHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
          More
        </button>
        {moreOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-20 cursor-default"
              aria-label="Close more menu"
              onClick={() => setMoreOpen(false)}
            />
            <div
              role="menu"
              className="absolute left-0 top-full z-30 mt-1 min-w-[180px] rounded-lg border border-[var(--ws-border)] bg-slate-900 p-1 shadow-lg"
            >
              {SALES_SECONDARY_TABS.map((tab) => {
                const isActive = isSalesWorkspaceTabActive(pathname, tab.href);
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      'flex items-center gap-2 min-h-11 rounded-md px-3 text-[12px] font-medium',
                      isActive ? 'bg-teal-500/10 text-teal-300' : 'text-slate-300 hover:bg-white/5'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default SalesWorkspaceTabs;
