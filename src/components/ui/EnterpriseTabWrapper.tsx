'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { ENTERPRISE } from '@/constants/design';

interface EnterpriseTabWrapperProps {
  children: React.ReactNode;
  /** Routes that manage their own full-bleed scroll (mail, messages, etc.) */
  fullBleed?: boolean;
  className?: string;
}

/**
 * Applies enterprise structural patterns to every dashboard tab:
 * full scroll (no hidden content), consistent section spacing.
 */
export function EnterpriseTabWrapper({
  children,
  fullBleed = false,
  className,
}: EnterpriseTabWrapperProps) {
  return (
    <div
      className={cn(
        'ac-enterprise-module ac-workspace-canvas w-full min-w-0',
        fullBleed ? 'h-full min-h-0 flex flex-col' : cn('ac-scroll-full', ENTERPRISE.moduleLayout.sectionGap),
        className
      )}
    >
      {children}
    </div>
  );
}

/** Edge-to-edge dashboard routes — same list as BusinessDashboard. */
export const ENTERPRISE_FULL_BLEED_TABS = new Set([
  '/dashboard/mail',
  '/dashboard/business/projects',
  '/dashboard/tasks',
  '/dashboard/sales-agent',
  '/dashboard/leads/campaigns',
  '/dashboard/zoho/mail',
  '/dashboard/business/messages',
  '/dashboard/messages',
  '/dashboard/pwa-settings',
  '/dashboard/conference',
  '/dashboard/meetings',
  '/dashboard/business/meetings',
  '/dashboard/business/social',
  '/dashboard/social',
  '/dashboard/business/social/compose',
  '/dashboard/social/compose',
  '/dashboard/business/social-command',
  '/dashboard/business/linkedin',
  '/dashboard/business/facebook',
  '/dashboard/business/instagram',
  '/dashboard/business/x',
]);

export function isEnterpriseFullBleedTab(tab: string): boolean {
  return ENTERPRISE_FULL_BLEED_TABS.has(tab);
}
