'use client';

import React from 'react';
import {
  BriefcaseBusiness,
  CalendarPlus,
  FilePlus2,
  MailPlus,
  PenSquare,
  Plus,
  Receipt,
  UserPlus,
  X,
} from 'lucide-react';
import type { UserRole } from '@/types';
import { ENTERPRISE } from '@/constants/design';
import { cn } from '@/lib/utils';

interface MobileCreateSheetProps {
  open: boolean;
  onClose: () => void;
  userRole: UserRole;
  onNavigate: (href: string) => void;
}

export function MobileCreateSheet({ open, onClose, userRole, onNavigate }: MobileCreateSheetProps) {
  if (!open) return null;

  const isTenant = userRole === 'tenant_admin' || userRole === 'business_dashboard';
  const actions = [
    { label: 'Add client', href: '/dashboard/crm/workspace?quickAdd=true', icon: UserPlus },
    { label: 'Email client', href: '/dashboard/mail?compose=true', icon: MailPlus },
    { label: 'New task', href: '/dashboard/tasks?create=true', icon: Plus },
    { label: 'New meeting', href: isTenant ? '/dashboard/business/calendar?create=true' : '/dashboard/calendar?create=true', icon: CalendarPlus },
    { label: 'New deal', href: '/dashboard/deals?create=true', icon: BriefcaseBusiness },
    { label: 'New invoice', href: isTenant ? '/dashboard/business/billing/manage?create=true' : '/dashboard/finance/manage?create=true', icon: Receipt },
    { label: 'New project', href: isTenant ? '/dashboard/business/projects/manage?create=true' : '/dashboard/projects/manage?create=true', icon: FilePlus2 },
    { label: 'Social post', href: isTenant ? '/dashboard/business/social/compose' : '/dashboard/social/compose', icon: PenSquare },
  ];

  const choose = (href: string) => {
    onNavigate(href);
    onClose();
  };

  return (
    <div className="ac-responsive-create-sheet md:hidden fixed inset-0 z-[1210] flex flex-col" role="dialog" aria-modal="true" aria-labelledby="mobile-create-title">
      <button type="button" className="absolute inset-0 bg-black/55 backdrop-blur-sm" aria-label="Close create menu" onClick={onClose} />
      <div className="ac-v3-sheet relative mt-auto flex max-h-[82dvh] flex-col rounded-t-[22px] border border-[var(--border-default)] pb-safe">
        <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 pb-3 pt-4">
          <h2 id="mobile-create-title" className="text-base font-semibold text-[var(--text-primary)]">Create</h2>
          <button
            type="button"
            onClick={onClose}
            className={cn(ENTERPRISE.touchTarget, 'rounded-xl text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]')}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 overflow-y-auto p-4">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => choose(action.href)}
                className="native-tap flex min-h-[88px] flex-col items-start justify-between rounded-2xl border border-[var(--border-default)] bg-[var(--surface-secondary)] p-3 text-left active:scale-[0.98]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--ac-accent)_12%,transparent)] text-[var(--ac-accent)]">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="mt-3 type-ui font-semibold text-[var(--text-primary)]">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default MobileCreateSheet;
