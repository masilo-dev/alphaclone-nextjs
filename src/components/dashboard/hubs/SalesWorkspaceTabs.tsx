'use client';

import React from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SalesWorkspaceTab {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const SALES_WORKSPACE_TABS: SalesWorkspaceTab[] = [
  { label: 'Overview', href: '/dashboard/crm', icon: LayoutGrid },
  { label: 'Workspace', href: '/dashboard/crm/workspace', icon: Workflow },
  { label: 'Pipeline', href: '/dashboard/deals', icon: Target },
  { label: 'Leads', href: '/dashboard/leads', icon: TrendingUp },
  { label: 'Contacts', href: '/dashboard/contacts', icon: Contact },
  { label: 'Accounts', href: '/dashboard/crm/accounts', icon: Users },
  { label: 'Console', href: '/dashboard/crm/console', icon: MessageCircle },
  { label: 'Reports', href: '/dashboard/crm/reports', icon: FileText },
  { label: 'Lead Finder', href: '/dashboard/leads/campaigns', icon: Search },
  { label: 'Tasks', href: '/dashboard/tasks', icon: CheckSquare },
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
  return pathname === href || pathname.startsWith(`${href}?`);
}

interface SalesWorkspaceTabsProps {
  pathname: string;
  compact?: boolean;
  className?: string;
}

export function SalesWorkspaceTabs({ pathname, compact = false, className }: SalesWorkspaceTabsProps) {
  return (
    <div
      className={cn(
        'flex gap-2 overflow-x-auto ios-scroll -mx-1 px-1 pb-1 md:flex-wrap md:overflow-visible',
        compact ? 'py-0.5' : 'mt-3',
        className
      )}
    >
      {SALES_WORKSPACE_TABS.map((tab) => {
        const isActive = isSalesWorkspaceTabActive(pathname, tab.href);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex-shrink-0 inline-flex items-center gap-1.5 min-h-11 px-3.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap',
              isActive
                ? 'bg-teal-500 text-white border-teal-500 shadow-md shadow-teal-500/10'
                : 'bg-slate-900 text-slate-400 border-white/5 hover:border-teal-500/30 hover:text-white'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
