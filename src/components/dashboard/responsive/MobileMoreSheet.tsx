'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import type { UserRole } from '@/types';
import { getMoreCatalogue } from '@/config/responsive/mobileNav';
import { getCompanionCapabilityForPath } from '@/config/pwaCompanionCapabilities';
import { ENTERPRISE } from '@/constants/design';
import { cn } from '@/lib/utils';

interface MobileMoreSheetProps {
  open: boolean;
  onClose: () => void;
  userRole: UserRole;
  onNavigate?: (href: string) => void;
}

const CAPABILITY_LABEL = {
  FULL: 'Mobile ready',
  COMPANION: 'Quick actions',
  READ_ONLY: 'View on mobile',
  DESKTOP: 'Desktop controls',
} as const;

/**
 * Full module catalogue opened from the phone bottom-nav "More" slot.
 * Every major module stays discoverable; capability labels make intentional
 * desktop-first behavior clear instead of hiding modules.
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
    <div className="ac-responsive-more-sheet md:hidden fixed inset-0 z-[1200] flex flex-col" role="dialog" aria-modal="true" aria-labelledby="mobile-more-title">
      <button type="button" className="absolute inset-0 bg-black/55 backdrop-blur-sm" aria-label="Close module catalogue" onClick={onClose} />
      <div className="ac-v3-sheet relative mt-auto max-h-[88dvh] flex flex-col rounded-t-[22px] border border-[var(--border-default)] pb-safe">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[var(--border-default)]">
          <div>
            <h2 id="mobile-more-title" className="text-base font-semibold text-[var(--text-primary)]">More</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Every AlphaClone module, adapted for mobile where appropriate</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(ENTERPRISE.touchTarget, 'rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]')}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-3 space-y-5">
          {groups.map((group) => (
            <section key={group.id} aria-labelledby={`more-group-${group.id}`}>
              <h3 id={`more-group-${group.id}`} className="text-[11px] font-semibold tracking-wide text-[var(--text-muted)] mb-2">
                {group.label}
              </h3>
              <ul className="grid grid-cols-1 gap-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const capability = getCompanionCapabilityForPath(item.href);
                  return (
                    <li key={item.href + item.label}>
                      <button
                        type="button"
                        onClick={() => go(item.href)}
                        className="native-tap w-full flex items-center gap-3 min-h-14 px-3 rounded-[12px] text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)] active:scale-[0.99]"
                      >
                        <span className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--ac-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--ac-accent)_20%,transparent)] flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-[var(--ac-accent)]" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium truncate">{item.label}</span>
                          <span className="block text-[10px] leading-4 text-[var(--text-muted)]">{CAPABILITY_LABEL[capability.level]}</span>
                        </span>
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
