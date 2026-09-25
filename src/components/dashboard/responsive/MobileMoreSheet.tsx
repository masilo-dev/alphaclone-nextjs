'use client';

import React from 'react';
import { X } from 'lucide-react';
import type { UserRole } from '@/types';
import { getMoreCatalogue } from '@/config/responsive/mobileNav';
import { getCompanionCapabilityForPath } from '@/config/pwaCompanionCapabilities';
import { ENTERPRISE } from '@/constants/design';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface MobileMoreSheetProps {
  open: boolean;
  onClose: () => void;
  userRole: UserRole;
  onNavigate?: (href: string) => void;
}

/**
 * Full module catalogue opened from the phone bottom-nav "More" slot.
 * Every major module stays discoverable without turning the phone menu into a
 * compressed desktop navigation tree.
 */
export function MobileMoreSheet({ open, onClose, userRole, onNavigate }: MobileMoreSheetProps) {
  const { t } = useLanguage();
  const groups = getMoreCatalogue(userRole);

  if (!open) return null;

  const go = (href: string) => {
    onNavigate?.(href);
    onClose();
  };

  return (
    <div className="ac-responsive-more-sheet md:hidden fixed inset-0 z-[1200] flex flex-col" role="dialog" aria-modal="true" aria-labelledby="mobile-more-title">
      <button type="button" className="absolute inset-0 bg-black/55 backdrop-blur-sm" aria-label={t('Close module catalogue')} onClick={onClose} />
      <div className="ac-v3-sheet relative mt-auto max-h-[88dvh] flex flex-col rounded-t-[22px] border border-[var(--border-default)] pb-safe">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[var(--border-default)]">
          <h2 id="mobile-more-title" className="text-base font-semibold text-[var(--text-primary)]">{t('More')}</h2>
          <button
            type="button"
            onClick={onClose}
            className={cn(ENTERPRISE.touchTarget, 'rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]')}
            aria-label={t('Close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-3 space-y-5">
          {groups.map((group) => (
            <section key={group.id} aria-labelledby={`more-group-${group.id}`}>
              <h3 id={`more-group-${group.id}`} className="type-caption font-semibold tracking-wide text-[var(--text-muted)] mb-2">
                {t(group.label)}
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
                        className="native-tap w-full flex items-center gap-3 min-h-14 px-3 rounded-[12px] text-left type-ui text-[var(--text-primary)] hover:bg-[var(--surface-hover)] active:scale-[0.99]"
                      >
                        <span className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--ac-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--ac-accent)_20%,transparent)] flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-[var(--ac-accent)]" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium truncate">{t(item.label)}</span>
                          {capability.level === 'DESKTOP' ? (
                            <span className="block type-ui leading-4 text-[var(--text-muted)]">{t('Use on laptop')}</span>
                          ) : null}
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
