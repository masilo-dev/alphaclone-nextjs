'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import type { UserRole } from '@/types';
import { getMoreCatalogue } from '@/config/responsive/mobileNav';
import { ENTERPRISE } from '@/constants/design';
import { cn } from '@/lib/utils';

interface MobileMoreSheetProps {
  open: boolean;
  onClose: () => void;
  userRole: UserRole;
  onNavigate?: (href: string) => void;
}

/**
 * Full module catalogue opened from the phone bottom-nav "More" slot.
 * Grouped by business job — not a duplicate of the desktop sidebar tree.
 */
export function MobileMoreSheet({ open, onClose, userRole, onNavigate }: MobileMoreSheetProps) {
  const router = useRouter();
  const groups = getMoreCatalogue(userRole);

  if (!open) return null;

  const go = (href: string) => {
    onNavigate?.(href);
    router.push(href);
    onClose();
  };

  return (
    <div className="md:hidden fixed inset-0 z-[1200] flex flex-col" role="dialog" aria-modal="true" aria-labelledby="mobile-more-title">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close module catalogue"
        onClick={onClose}
      />
      <div className="relative mt-auto max-h-[88dvh] flex flex-col rounded-t-2xl border border-[var(--ws-border)] bg-[var(--app-surface,#1e1e1e)] shadow-2xl pb-safe">
        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-[var(--ws-border)]">
          <div>
            <h2 id="mobile-more-title" className="text-base font-semibold text-white">
              More modules
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Grouped by what you need to get done</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(ENTERPRISE.touchTarget, 'rounded-lg text-slate-400 hover:text-white hover:bg-white/5')}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-3 space-y-5">
          {groups.map((group) => (
            <section key={group.id} aria-labelledby={`more-group-${group.id}`}>
              <h3
                id={`more-group-${group.id}`}
                className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2"
              >
                {group.label}
              </h3>
              <ul className="grid grid-cols-1 gap-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.href + item.label}>
                      <button
                        type="button"
                        onClick={() => go(item.href)}
                        className="w-full flex items-center gap-3 min-h-12 px-3 rounded-xl text-left text-sm text-slate-200 hover:bg-white/5 active:bg-white/10"
                      >
                        <span className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-teal-400" aria-hidden />
                        </span>
                        <span className="font-medium">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MobileMoreSheet;
